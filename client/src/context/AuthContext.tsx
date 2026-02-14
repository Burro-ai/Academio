import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  UserRole,
  StudentProfile,
  LoginRequest,
  RegisterRequest,
} from '@/types';
import { authApi } from '@/services/authApi';

interface AuthContextType {
  user: User | null;
  profile: StudentProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  isReady: boolean; // True when auth state is fully loaded and validated
  error: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  waitForAuth: () => Promise<boolean>; // Wait for auth to be ready, returns isAuthenticated
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Initialize with stored data for instant hydration (no flash)
  const [user, setUser] = useState<User | null>(() => authApi.getStoredUser());
  const [profile, setProfile] = useState<StudentProfile | null>(() => authApi.getStoredProfile());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user;

  // Get redirect path based on role
  const getRedirectPath = (role: UserRole): string => {
    return role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';
  };

  // Check and validate authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = authApi.getToken();

      // If no token exists at all, user is not logged in
      if (!token) {
        console.log('[Auth] No token found, user not logged in');
        setUser(null);
        setProfile(null);
        setIsInitializing(false);
        return;
      }

      // We have a token - first try to use stored data for instant hydration
      const storedUser = authApi.getStoredUser();
      const storedProfile = authApi.getStoredProfile();

      if (storedUser) {
        // Immediately set stored user for instant UI (no flash)
        setUser(storedUser);
        setProfile(storedProfile);
        console.log('[Auth] Hydrated from localStorage:', storedUser.email, 'role:', storedUser.role);
      }

      // Check if token appears expired (client-side check)
      if (authApi.isTokenExpired()) {
        console.log('[Auth] Token appears expired, clearing auth data');
        setUser(null);
        setProfile(null);
        authApi.clearAll();
        setIsInitializing(false);
        return;
      }

      // Token looks valid - validate with server and get fresh data
      try {
        const { user: currentUser, profile: currentProfile } = await authApi.getCurrentUser();
        setUser(currentUser);
        setProfile(currentProfile);
        console.log('[Auth] Session validated with server for:', currentUser.email, 'role:', currentUser.role);
      } catch (err) {
        // Server rejected the token - clear everything
        console.error('[Auth] Server rejected token:', err);
        setUser(null);
        setProfile(null);
        authApi.clearAll();
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, []);

  // Redirect to login if not authenticated (except for public routes)
  useEffect(() => {
    // Wait for initialization to complete before redirecting
    if (isInitializing) return;

    const publicRoutes = ['/login', '/register', '/admin'];
    const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));

    if (!isAuthenticated && !isPublicRoute && location.pathname !== '/') {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [isAuthenticated, isInitializing, location.pathname, navigate]);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(data);
      setUser(response.user);

      // Fetch profile if student (this also stores it in localStorage via getCurrentUser)
      // Use case-insensitive comparison for role
      if (response.user.role?.toUpperCase() === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      } else {
        setProfile(null);
        authApi.setStoredProfile(null);
      }

      // Navigate to appropriate dashboard
      const from = (location.state as { from?: string })?.from;
      // Normalize role for redirect path
      const normalizedRole = response.user.role?.toUpperCase() === 'TEACHER' ? 'TEACHER' : 'STUDENT';
      const redirectTo = from || response.redirectTo || getRedirectPath(normalizedRole as UserRole);
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, location.state]);

  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.register(data);
      setUser(response.user);

      // Fetch profile if student (this also stores it in localStorage via getCurrentUser)
      // Use case-insensitive comparison for role
      if (response.user.role?.toUpperCase() === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      } else {
        setProfile(null);
        authApi.setStoredProfile(null);
      }

      // Navigate to appropriate dashboard
      // Normalize role for redirect path
      const normalizedRole = response.user.role?.toUpperCase() === 'TEACHER' ? 'TEACHER' : 'STUDENT';
      const redirectTo = response.redirectTo || getRedirectPath(normalizedRole as UserRole);
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await authApi.logout();
    } catch {
      // Even if logout API fails, clear local state
      authApi.clearAll();
    } finally {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      navigate('/login');
    }
  }, [navigate]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!authApi.isAuthenticated()) return;

    try {
      const { user: currentUser, profile: currentProfile } = await authApi.getCurrentUser();
      setUser(currentUser);
      setProfile(currentProfile);
    } catch (err) {
      // If refresh fails, logout
      await logout();
    }
  }, [logout]);

  // Wait for auth to be ready - useful for components that need to ensure auth is loaded
  const waitForAuth = useCallback(async (): Promise<boolean> => {
    // If already initialized, return current state
    if (!isInitializing) {
      return isAuthenticated;
    }

    // Wait for initialization to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if still initializing by looking at authApi state
        if (!isInitializing) {
          clearInterval(checkInterval);
          resolve(!!user);
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(!!user);
      }, 5000);
    });
  }, [isInitializing, isAuthenticated, user]);

  // isReady = not initializing and we have a definitive auth state
  const isReady = !isInitializing;

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated,
    isLoading,
    isInitializing,
    isReady,
    error,
    login,
    register,
    logout,
    clearError,
    refreshUser,
    waitForAuth,
  };

  // Show loading spinner while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {/* Liquid Glass style spinner */}
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 animate-pulse" />
            <div className="absolute inset-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          </div>
          <p className="text-white/70 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
