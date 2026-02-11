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
   */
  isTokenExpired(): boolean {
    const payload = this.getTokenPayload();
    if (!payload || !payload.exp) return true;

    // Check if expired (with 1 minute buffer to account for clock drift)
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const bufferMs = 60 * 1000; // 1 minute buffer

    return now >= (expiryTime - bufferMs);
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
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    // Check if token is expired
    if (this.isTokenExpired()) {
      console.log('[Auth] Token is expired, clearing auth data');
      this.clearAll();
      return false;
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
