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
  error: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user;

  // Get redirect path based on role
  const getRedirectPath = (role: UserRole): string => {
    return role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';
  };

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!authApi.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      try {
        const { user: currentUser, profile: currentProfile } = await authApi.getCurrentUser();
        setUser(currentUser);
        setProfile(currentProfile);
      } catch (err) {
        // Token invalid, clear it
        authApi.removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Redirect to login if not authenticated (except for public routes)
  useEffect(() => {
    if (isLoading) return;

    const publicRoutes = ['/login', '/register', '/admin'];
    const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));

    if (!isAuthenticated && !isPublicRoute && location.pathname !== '/') {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate]);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(data);
      setUser(response.user);

      // Fetch profile if student
      if (response.user.role === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      }

      // Navigate to appropriate dashboard
      const from = (location.state as { from?: string })?.from;
      const redirectTo = from || response.redirectTo || getRedirectPath(response.user.role);
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
      if (response.user.role === 'STUDENT') {
        const { profile: userProfile } = await authApi.getCurrentUser();
        setProfile(userProfile);
      }

      // Navigate to appropriate dashboard
      const redirectTo = response.redirectTo || getRedirectPath(response.user.role);
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

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
    refreshUser,
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
