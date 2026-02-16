import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  UserRole,
  StudentProfile,
  LoginRequest,
  RegisterRequest,
} from '@/types';
import { authApi } from '@/services/authApi';
import {
  preflightAuthCheck,
  onAuthEvent,
  normalizeRole,
  initializeAuthInterceptor,
} from '@/services/authInterceptor';

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

// Initialize the interceptor once at module load (before React renders)
initializeAuthInterceptor();

// Pre-flight check runs BEFORE React component tree
const initialAuthState = preflightAuthCheck();

export function AuthProvider({ children }: AuthProviderProps) {
  // Initialize with pre-flight data for INSTANT hydration (no flash)
  const [user, setUser] = useState<User | null>(() => {
    if (initialAuthState.user) {
      return {
        ...initialAuthState.user,
        role: normalizeRole(initialAuthState.user.role) || 'STUDENT',
        createdAt: '',
        updatedAt: '',
      } as User;
    }
    return null;
  });
  const [profile, setProfile] = useState<StudentProfile | null>(() => authApi.getStoredProfile());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(initialAuthState.needsVerification);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  const isAuthenticated = !!user;

  // Get redirect path based on role
  const getRedirectPath = (role: UserRole): string => {
    return role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';
  };

  // Subscribe to global logout events from the interceptor
  useEffect(() => {
    const unsubscribe = onAuthEvent((event) => {
      if (event.type === 'logout' && isMountedRef.current) {
        console.log('[AuthContext] Received logout event:', event.reason);
        setUser(null);
        setProfile(null);
        setIsInitializing(false);

        // Only navigate if not already on a public route
        const publicRoutes = ['/login', '/register', '/admin', '/'];
        if (!publicRoutes.some(route => location.pathname.startsWith(route))) {
          navigate('/login', { state: { from: location.pathname, reason: event.reason } });
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [navigate, location.pathname]);

  // Verify authentication with server on mount
  useEffect(() => {
    const verifyAuth = async () => {
      // If no token or pre-flight said no verification needed, we're done
      if (!initialAuthState.needsVerification || !initialAuthState.token) {
        setIsInitializing(false);
        return;
      }

      try {
        // Verify with server and get fresh data
        const { user: currentUser, profile: currentProfile } = await authApi.getCurrentUser();

        if (isMountedRef.current) {
          setUser(currentUser);
          setProfile(currentProfile);
          console.log('[AuthContext] Session verified with server for:', currentUser.email, 'role:', currentUser.role);
        }
      } catch (err) {
        // Server rejected the token - interceptor will handle logout
        console.error('[AuthContext] Server rejected token:', err);
        if (isMountedRef.current) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
      }
    };

    verifyAuth();
  }, []); // Run once on mount

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
      const normalizedRole = normalizeRole(response.user.role);
      if (normalizedRole === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      } else {
        setProfile(null);
        authApi.setStoredProfile(null);
      }

      // Navigate to appropriate dashboard
      const from = (location.state as { from?: string })?.from;
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

      // Fetch profile if student
      const normalizedRole = normalizeRole(response.user.role);
      if (normalizedRole === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      } else {
        setProfile(null);
        authApi.setStoredProfile(null);
      }

      // Navigate to appropriate dashboard
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
      // If refresh fails, logout (interceptor handles 401)
      console.error('[AuthContext] Failed to refresh user:', err);
    }
  }, []);

  // Wait for auth to be ready - useful for components that need to ensure auth is loaded
  const waitForAuth = useCallback(async (): Promise<boolean> => {
    // If already initialized, return current state
    if (!isInitializing) {
      return isAuthenticated;
    }

    // Wait for initialization to complete (max 5 seconds)
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (!isInitializing || Date.now() - startTime > 5000) {
          clearInterval(checkInterval);
          resolve(!!user);
        }
      }, 10); // Check every 10ms for fast response
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

  // BLOCKING HYDRATION: Show loading spinner while initializing
  // This prevents the app from rendering in an inconsistent state
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {/* Liquid Glass style spinner */}
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 animate-pulse" />
            <div className="absolute inset-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          </div>
          <p className="text-white/70 text-sm">Verificando sesion...</p>
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
