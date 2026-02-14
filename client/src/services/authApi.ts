import {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  StudentProfile,
} from '@/types';

const API_BASE = '/api/auth';

const TOKEN_KEY = 'academio_token';
const USER_KEY = 'academio_user';
const PROFILE_KEY = 'academio_profile';

class AuthApiService {
  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Store token
   */
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Remove token
   */
  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Get stored user
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Store user
   */
  setStoredUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /**
   * Remove stored user
   */
  removeStoredUser(): void {
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Get stored profile
   */
  getStoredProfile(): StudentProfile | null {
    const profileStr = localStorage.getItem(PROFILE_KEY);
    if (!profileStr) return null;
    try {
      return JSON.parse(profileStr);
    } catch {
      return null;
    }
  }

  /**
   * Store profile
   */
  setStoredProfile(profile: StudentProfile | null): void {
    if (profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_KEY);
    }
  }

  /**
   * Remove stored profile
   */
  removeStoredProfile(): void {
    localStorage.removeItem(PROFILE_KEY);
  }

  /**
   * Clear all stored auth data
   */
  clearAll(): void {
    this.removeToken();
    this.removeStoredUser();
    this.removeStoredProfile();
  }

  /**
   * Check if token is expired (with 1 minute buffer)
   * Returns false (not expired) if we can't parse the token - let server validate
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) {
      console.log('[Auth] No token found');
      return true;
    }

    const payload = this.getTokenPayload();

    // If we can't parse the payload, don't assume expired - let server validate
    // This prevents logout due to parsing issues
    if (!payload) {
      console.warn('[Auth] Could not parse token payload, assuming valid - server will validate');
      return false;
    }

    // If no exp claim, assume valid (server will validate)
    if (!payload.exp) {
      console.warn('[Auth] Token has no exp claim, assuming valid');
      return false;
    }

    // Check if expired (with 1 minute buffer to account for clock drift)
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const bufferMs = 60 * 1000; // 1 minute buffer

    const isExpired = now >= (expiryTime - bufferMs);

    if (isExpired) {
      console.log('[Auth] Token expired at', new Date(expiryTime).toISOString(), 'current time:', new Date(now).toISOString());
    }

    return isExpired;
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Register new user
   * Note: Clears any existing auth data before registration
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    // Clear any existing auth data
    this.clearAll();

    // Make register request without auth header
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const result = await response.json() as RegisterResponse;

    // Store token and user data
    this.setToken(result.token);
    this.setStoredUser(result.user);

    console.log('[Auth] Registration successful, user role:', result.user.role);

    return result;
  }

  /**
   * Decode base64url (JWT uses URL-safe base64, not standard base64)
   */
  private base64UrlDecode(str: string): string {
    // Replace URL-safe characters with standard base64 characters
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }

    try {
      return atob(base64);
    } catch (e) {
      console.error('[Auth] Failed to decode base64:', e);
      throw e;
    }
  }

  /**
   * Debug: Get decoded token payload (without verification)
   */
  getTokenPayload(): { id?: string; email?: string; role?: string; exp?: number; iat?: number } | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('[Auth] Invalid token format - expected 3 parts, got', parts.length);
        return null;
      }

      const decoded = this.base64UrlDecode(parts[1]);
      const payload = JSON.parse(decoded);

      return payload;
    } catch (e) {
      console.error('[Auth] Failed to parse token payload:', e);
      return null;
    }
  }

  /**
   * Login user
   * Note: Clears any existing auth data before login to prevent stale data issues
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    // Clear any existing auth data to prevent stale data issues
    this.clearAll();

    // Make login request without auth header
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const result = await response.json() as LoginResponse;

    // Store token and user data
    this.setToken(result.token);
    this.setStoredUser(result.user);

    console.log('[Auth] Login successful, user role:', result.user.role);

    return result;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.request('/logout', { method: 'POST' });
    } finally {
      this.clearAll();
    }
  }

  /**
   * Get current user and update stored data
   */
  async getCurrentUser(): Promise<{ user: User; profile: StudentProfile | null }> {
    const result = await this.request<{ user: User; profile: StudentProfile | null }>('/me');

    // Update stored user and profile data
    this.setStoredUser(result.user);
    this.setStoredProfile(result.profile);

    return result;
  }

  /**
   * Update user profile
   */
  async updateProfile(data: { name?: string; avatarUrl?: string }): Promise<{ user: User }> {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update password
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  /**
   * Verify token is valid
   */
  async verifyToken(): Promise<{ valid: boolean; user: User }> {
    return this.request('/verify', { method: 'POST' });
  }

  /**
   * Check if user is authenticated (has token and it's not expired)
   * Only clears data if token is definitively expired, not on parsing errors
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    // Check if token is expired
    // isTokenExpired now returns false on parsing errors (let server validate)
    if (this.isTokenExpired()) {
      console.log('[Auth] Token is expired, clearing auth data');
      this.clearAll();
      return false;
    }

    // Also verify we have stored user data for consistency
    const storedUser = this.getStoredUser();
    if (!storedUser) {
      console.warn('[Auth] Token exists but no stored user, will validate with server');
      // Don't clear token - let the AuthContext try to fetch user from server
    }

    return true;
  }

  /**
   * Check if we have valid stored auth data for immediate hydration
   */
  hasStoredAuth(): boolean {
    return this.isAuthenticated() && !!this.getStoredUser();
  }
}

export const authApi = new AuthApiService();
