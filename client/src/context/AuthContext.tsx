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
  // NON-BLOCKING: Don't block rendering, verify in background
  const [isVerifying, setIsVerifying] = useState(initialAuthState.needsVerification);
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
        setIsVerifying(false);

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

  // Verify authentication with server on mount (NON-BLOCKING)
  useEffect(() => {
    const verifyAuth = async () => {
      // If no token or pre-flight said no verification needed, we're done
      if (!initialAuthState.needsVerification || !initialAuthState.token) {
        console.log('[AuthContext] No verification needed, skipping');
        setIsVerifying(false);
        return;
      }

      console.log('[AuthContext] Starting background session verification...');

      // Create a timeout promise (3 seconds max wait)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Verification timeout')), 3000);
      });

      try {
        // Race between verification and timeout
        const { user: currentUser, profile: currentProfile } = await Promise.race([
          authApi.getCurrentUser(),
          timeoutPromise,
        ]);

        if (isMountedRef.current) {
          setUser(currentUser);
          setProfile(currentProfile);
          console.log('[AuthContext] Session verified with server for:', currentUser.email, 'role:', currentUser.role);
        }
      } catch (err) {
        // Server rejected the token, timeout, or network error
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[AuthContext] Verification failed:', errorMsg);

        if (isMountedRef.current) {
          // On timeout, keep using stored data ONLY if we have valid user
          if (errorMsg === 'Verification timeout' && user) {
            console.log('[AuthContext] Timeout - continuing with stored auth data');
          } else {
            // Server explicitly rejected OR we have no user - clear auth
            console.log('[AuthContext] Clearing auth - rejection or missing user');
            setUser(null);
            setProfile(null);
            authApi.clearAll();
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsVerifying(false);
          console.log('[AuthContext] Verification complete, isVerifying set to false');
        }
      }
    };

    // Safety timeout: ensure isVerifying is set to false even if something goes wrong
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && isVerifying) {
        console.warn('[AuthContext] Safety timeout triggered - forcing isVerifying to false');
        setIsVerifying(false);
      }
    }, 5000);

    verifyAuth();

    return () => clearTimeout(safetyTimeout);
  }, []); // Run once on mount

  // Redirect to login if not authenticated (except for public routes)
  useEffect(() => {
    // Don't redirect while still verifying - user might be authenticated
    if (isVerifying) return;

    const publicRoutes = ['/login', '/register', '/admin'];
    const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));

    if (!isAuthenticated && !isPublicRoute && location.pathname !== '/') {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [isAuthenticated, isVerifying, location.pathname, navigate]);

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
    // If not verifying, return current state immediately
    if (!isVerifying) {
      return isAuthenticated;
    }

    // Wait for verification to complete (max 3 seconds)
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (!isVerifying || Date.now() - startTime > 3000) {
          clearInterval(checkInterval);
          resolve(!!user);
        }
      }, 50); // Check every 50ms
    });
  }, [isVerifying, isAuthenticated, user]);

  // isReady = not initializing (always true now since we don't block)
  // isVerifying indicates background verification is in progress
  const isReady = true;

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated,
    isLoading,
    isInitializing: isVerifying, // Map to isVerifying for backwards compatibility
    isReady,
    error,
    login,
    register,
    logout,
    clearError,
    refreshUser,
    waitForAuth,
  };

  // NON-BLOCKING: Render children immediately, verification happens in background
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
