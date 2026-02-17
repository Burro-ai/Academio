/**
 * Atomic Auth Interceptor
 *
 * A global fetch/request interceptor that ensures authentication tokens are
 * properly injected into all API requests BEFORE the React tree renders.
 *
 * Key Features:
 * - Synchronous token retrieval from localStorage
 * - Automatic Bearer token injection
 * - 401 response handling with forced logout
 * - SSE stream authentication support
 * - Case-insensitive role normalization
 *
 * Architecture: "Persistence-First"
 * - Token is read from localStorage synchronously on app load
 * - All API calls go through this interceptor
 * - 401 responses trigger immediate auth state wipe
 */

const TOKEN_KEY = 'academio_token';
const USER_KEY = 'academio_user';
const PROFILE_KEY = 'academio_profile';

// Event for global logout notification
type AuthEventType = 'logout' | 'tokenRefresh' | 'sessionExpired';

interface AuthEvent {
  type: AuthEventType;
  reason?: string;
}

type AuthEventListener = (event: AuthEvent) => void;

// Global event listeners for auth state changes
const authEventListeners: Set<AuthEventListener> = new Set();

/**
 * Subscribe to auth events (logout, token refresh, etc.)
 */
export function onAuthEvent(listener: AuthEventListener): () => void {
  authEventListeners.add(listener);
  return () => authEventListeners.delete(listener);
}

/**
 * Emit an auth event to all listeners
 */
function emitAuthEvent(event: AuthEvent): void {
  authEventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('[AuthInterceptor] Error in auth event listener:', error);
    }
  });
}

/**
 * Synchronously get the stored token from localStorage
 * This runs BEFORE React renders, ensuring no race conditions
 */
export function getTokenSync(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // localStorage not available (SSR, private browsing, etc.)
    return null;
  }
}

/**
 * Synchronously get the stored user from localStorage
 */
export function getStoredUserSync(): { id: string; email: string; role: string; schoolId?: string } | null {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Clear all auth data from localStorage
 * Called on 401 responses or explicit logout
 */
export function clearAuthData(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Force logout - clears auth data and emits logout event
 * Called when server returns 401 (token expired/invalid)
 */
export function forceLogout(reason: string = 'session_expired'): void {
  console.log('[AuthInterceptor] Force logout triggered:', reason);
  clearAuthData();
  emitAuthEvent({ type: 'logout', reason });
}

/**
 * Normalize role to uppercase for case-insensitive comparison
 */
export function normalizeRole(role: string | undefined): 'STUDENT' | 'TEACHER' | null {
  if (!role) return null;
  const upper = role.toUpperCase();
  if (upper === 'STUDENT' || upper === 'TEACHER') {
    return upper as 'STUDENT' | 'TEACHER';
  }
  return null;
}

/**
 * Check if the current token appears to be expired (client-side check)
 * Returns false on parsing errors to let server validate
 */
export function isTokenExpiredSync(): boolean {
  const token = getTokenSync();
  if (!token) return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false; // Let server validate

    // Decode base64url payload
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) base64 += '='.repeat(4 - padding);

    const payload = JSON.parse(atob(base64));

    if (!payload.exp) return false; // No expiry, let server validate

    // Check if expired with 1 minute buffer
    const expiryTime = payload.exp * 1000;
    const now = Date.now();
    const bufferMs = 60 * 1000;

    return now >= (expiryTime - bufferMs);
  } catch {
    // Parsing error, let server validate
    return false;
  }
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getTokenSync();
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

/**
 * Build headers with auth token injected
 */
function buildHeaders(existingHeaders?: HeadersInit): Headers {
  const headers = new Headers(existingHeaders);

  const token = getTokenSync();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure Content-Type for JSON if not set and not FormData
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

/**
 * Handle 401 responses - force logout and emit event
 */
async function handle401Response(response: Response): Promise<void> {
  // Parse error message if possible
  let reason = 'token_invalid';
  try {
    const body = await response.clone().json();
    if (body.error === 'Token expired') {
      reason = 'token_expired';
    } else if (body.error) {
      reason = body.error;
    }
  } catch {
    // Ignore parse errors
  }

  console.log('[AuthInterceptor] 401 received, forcing logout:', reason);
  forceLogout(reason);
}

/**
 * Intercepted fetch function that injects auth headers and handles 401s
 *
 * @param input - URL or Request object
 * @param init - Request options
 * @returns Promise resolving to Response
 *
 * Features:
 * - Automatically injects Bearer token from localStorage
 * - Handles 401 responses with forced logout
 * - Preserves original fetch behavior for non-API calls
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  // Only intercept API calls
  const isApiCall = url.startsWith('/api') || url.includes('/api/');

  if (!isApiCall) {
    return fetch(input, init);
  }

  // Skip auth injection for login/register endpoints
  const isAuthEndpoint = url.includes('/api/auth/login') ||
                         url.includes('/api/auth/register') ||
                         url.includes('/api/teacher/login') ||
                         url.includes('/api/teacher/verify');

  let headers: Headers;

  if (isAuthEndpoint) {
    // For auth endpoints, use original headers (they handle their own auth)
    headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  } else {
    // For all other API calls, inject auth header
    headers = buildHeaders(init?.headers);
  }

  // Make the request
  const response = await fetch(input, {
    ...init,
    headers,
  });

  // Handle 401 responses (except for login attempts)
  if (response.status === 401 && !isAuthEndpoint) {
    await handle401Response(response);
    // Return the response anyway so the caller can handle UI
  }

  return response;
}

/**
 * Create an authenticated EventSource for SSE streams
 *
 * Note: Native EventSource doesn't support custom headers, so we use
 * fetch with ReadableStream for authenticated SSE.
 *
 * @param url - SSE endpoint URL
 * @param onMessage - Callback for each SSE message
 * @param onError - Callback for errors
 * @returns Abort function to cancel the stream
 */
export function createAuthenticatedEventSource(
  url: string,
  onMessage: (event: { type: string; data: string }) => void,
  onError?: (error: Error) => void
): { abort: () => void; promise: Promise<void> } {
  const abortController = new AbortController();

  const promise = (async () => {
    try {
      const response = await authenticatedFetch(url, {
        signal: abortController.signal,
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
            if (currentData.trim()) {
              onMessage({ type: currentEvent, data: currentData });
            }
            currentEvent = 'message';
            currentData = '';
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was intentionally aborted
        return;
      }
      console.error('[AuthInterceptor] SSE error:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  })();

  return {
    abort: () => abortController.abort(),
    promise,
  };
}

/**
 * Pre-flight auth check - validates auth state before React renders
 *
 * This function should be called BEFORE ReactDOM.createRoot() to ensure
 * authentication state is determined synchronously.
 *
 * Returns:
 * - { isAuthenticated: true, user, needsVerification: true } if token AND user exist
 * - { isAuthenticated: false } if no token, no user, or token is expired
 */
export function preflightAuthCheck(): {
  isAuthenticated: boolean;
  user: { id: string; email: string; role: string; schoolId?: string } | null;
  token: string | null;
  needsVerification: boolean;
} {
  const token = getTokenSync();
  const user = getStoredUserSync();

  // No token = not authenticated
  if (!token) {
    console.log('[AuthInterceptor] Preflight: No token found');
    return { isAuthenticated: false, user: null, token: null, needsVerification: false };
  }

  // Token exists but no user data - clear and don't verify (incomplete state)
  if (!user) {
    console.log('[AuthInterceptor] Preflight: Token exists but no user data, clearing');
    clearAuthData();
    return { isAuthenticated: false, user: null, token: null, needsVerification: false };
  }

  // Token exists but appears expired
  if (isTokenExpiredSync()) {
    console.log('[AuthInterceptor] Preflight: Token expired, clearing');
    clearAuthData();
    return { isAuthenticated: false, user: null, token: null, needsVerification: false };
  }

  // Token and user both exist and token appears valid - verify in background
  console.log('[AuthInterceptor] Preflight: Valid auth state, will verify with server');
  return {
    isAuthenticated: true,
    user,
    token,
    needsVerification: true, // Server should still verify
  };
}

/**
 * Initialize the auth interceptor
 * Call this at app startup to set up global fetch interception
 */
export function initializeAuthInterceptor(): void {
  // Log initial auth state
  const authState = preflightAuthCheck();
  console.log('[AuthInterceptor] Initialized:', {
    isAuthenticated: authState.isAuthenticated,
    userEmail: authState.user?.email,
    userRole: authState.user?.role,
    needsVerification: authState.needsVerification,
  });
}

// Export a ready-to-use fetch that's authenticated
export { authenticatedFetch as fetch };
