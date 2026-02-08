// Unified Authentication Types

export type UserRole = 'STUDENT' | 'TEACHER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  avatarUrl?: string;
  schoolId?: string;               // Primary school (for multi-school support)
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  redirectTo: string; // '/dashboard/student' or '/dashboard/teacher'
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  schoolId?: string;               // Optional school to join on registration
}

export interface RegisterResponse {
  user: User;
  token: string;
  redirectTo: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  schoolId?: string;               // Include school context in token
  iat?: number;
  exp?: number;
}
