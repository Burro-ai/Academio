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
   * Note: Clears any existing token before registration
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    // Clear any existing token
    this.removeToken();

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

    // Store new token
    this.setToken(result.token);

    console.log('[Auth] Registration successful, user role:', result.user.role);

    return result;
  }

  /**
   * Debug: Get decoded token payload (without verification)
   */
  getTokenPayload(): { id?: string; email?: string; role?: string; exp?: number } | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Login user
   * Note: Clears any existing token before login to prevent stale token issues
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    // Clear any existing token to prevent stale token issues
    this.removeToken();

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

    // Store new token
    this.setToken(result.token);

    // Debug: Log token role (can be removed in production)
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
      this.removeToken();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<{ user: User; profile: StudentProfile | null }> {
    return this.request('/me');
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
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authApi = new AuthApiService();
