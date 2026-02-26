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
  /** @deprecated Always false once children render (blocking hydration). */
  isInitializing: boolean;
  /** @deprecated Always true once children render (blocking hydration). */
  isReady: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  /** @deprecated Hydration is now blocking — resolves immediately. */
  waitForAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize interceptor and run preflight synchronously BEFORE React renders.
initializeAuthInterceptor();
const initialAuthState = preflightAuthCheck();

const PUBLIC_ROUTES = ['/login', '/register', '/admin', '/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ── Synchronous hydration from localStorage (no flash) ──────────────────
  const [user, setUser] = useState<User | null>(() => {
    if (!initialAuthState.user) return null;
    return {
      ...initialAuthState.user,
      role: normalizeRole(initialAuthState.user.role) || 'STUDENT',
      createdAt: '',
      updatedAt: '',
    } as User;
  });

  const [profile, setProfile] = useState<StudentProfile | null>(
    () => authApi.getStoredProfile()
  );

  const [isLoading, setIsLoading] = useState(false);

  // BLOCKING: children don't render until this is true.
  // Skip if no verification needed (no token → login page renders immediately).
  const [isHydrated, setIsHydrated] = useState(!initialAuthState.needsVerification);

  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const isMountedRef = useRef(true);

  const isAuthenticated = !!user;

  const getRedirectPath = (role: UserRole): string =>
    role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';

  // ── 401 forced-logout from the fetch interceptor ────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthEvent((event) => {
      if (event.type === 'logout' && isMountedRef.current) {
        setUser(null);
        setProfile(null);
        if (!PUBLIC_ROUTES.some(r => location.pathname.startsWith(r))) {
          navigate('/login', { state: { from: location.pathname, reason: event.reason } });
        }
      }
    });
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [navigate, location.pathname]);

  // ── BLOCKING server verification ────────────────────────────────────────
  // Show loading screen until this resolves. Only runs when there is a token
  // to verify (initialAuthState.needsVerification === true).
  useEffect(() => {
    if (!initialAuthState.needsVerification || !initialAuthState.token) {
      setIsHydrated(true);
      return;
    }

    const verifyAuth = async () => {
      try {
        const { user: currentUser, profile: currentProfile } = await Promise.race([
          authApi.getCurrentUser(),
          // 5 s timeout — on timeout we KEEP stored data (offline/slow network resilience)
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);
        if (isMountedRef.current) {
          setUser(currentUser);
          setProfile(currentProfile);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMountedRef.current) {
          if (msg === 'timeout') {
            // Network issue — keep stored session, don't punish the user
            console.warn('[AuthContext] Verify timed out — keeping stored session');
          } else {
            // Server explicitly rejected the token — wipe everything
            console.log('[AuthContext] Verify rejected:', msg);
            setUser(null);
            setProfile(null);
            authApi.clearAll();
          }
        }
      } finally {
        if (isMountedRef.current) setIsHydrated(true);
      }
    };

    verifyAuth();
  }, []); // Runs once on mount

  // ── Route guard (only active once hydrated) ─────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated && !PUBLIC_ROUTES.some(r => location.pathname.startsWith(r))) {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [isAuthenticated, isHydrated, location.pathname, navigate]);

  // ── Auth actions ─────────────────────────────────────────────────────────
  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(data);
      setUser(response.user);
      const normalizedRole = normalizeRole(response.user.role);
      if (normalizedRole === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      } else {
        setProfile(null);
        authApi.setStoredProfile(null);
      }
      const from = (location.state as { from?: string })?.from;
      navigate(from || response.redirectTo || getRedirectPath(normalizedRole as UserRole));
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
      const normalizedRole = normalizeRole(response.user.role);
      if (normalizedRole === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      } else {
        setProfile(null);
        authApi.setStoredProfile(null);
      }
      navigate(response.redirectTo || getRedirectPath(normalizedRole as UserRole));
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
      authApi.clearAll();
    } finally {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      navigate('/login');
    }
  }, [navigate]);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    if (!authApi.isAuthenticated()) return;
    try {
      const { user: currentUser, profile: currentProfile } = await authApi.getCurrentUser();
      setUser(currentUser);
      setProfile(currentProfile);
    } catch (err) {
      console.error('[AuthContext] Failed to refresh user:', err);
    }
  }, []);

  // Hydration is now blocking — by the time children render isHydrated is already true.
  const waitForAuth = useCallback((): Promise<boolean> =>
    Promise.resolve(isAuthenticated), [isAuthenticated]);

  // ── BLOCKING gate: show loader until server verify completes ─────────────
  if (!isHydrated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'rgba(10,10,20,0.92)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', letterSpacing: '0.08em' }}>
          Verificando sesión...
        </span>
      </div>
    );
  }

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated,
    isLoading,
    isInitializing: false, // Always false once children render
    isReady: true,         // Always true once children render
    error,
    login,
    register,
    logout,
    clearError,
    refreshUser,
    waitForAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
