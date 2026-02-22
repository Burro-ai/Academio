/**
 * Permission Registry - Central RBAC Configuration
 *
 * Maps routes to required roles and provides route-level access control.
 * All role comparisons are case-insensitive to prevent "TEACHER" vs "teacher" mismatches.
 *
 * Architecture: "Persistence-First"
 * - Every route has explicit permission requirements
 * - No implicit permissions - denied by default
 * - Centralized audit trail for security reviews
 */

import { Response, NextFunction, Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtAuthenticatedRequest, JwtPayload, UserRole } from '../types';

// ============ Types ============

export type Permission = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PUBLIC' | 'AUTHENTICATED';

export interface RoutePermission {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';
  path: string;
  permissions: Permission[];
  description?: string;
}

// ============ Permission Registry ============

/**
 * Central registry of all routes and their required permissions.
 * Each entry maps a route pattern to the roles that can access it.
 *
 * Permission Types:
 * - STUDENT: Only students can access
 * - TEACHER: Only teachers can access
 * - ADMIN: Only admins can access (future use)
 * - PUBLIC: Anyone can access (no auth required)
 * - AUTHENTICATED: Any logged-in user can access
 */
export const PERMISSION_REGISTRY: RoutePermission[] = [
  // ============ Public Routes ============
  { method: 'GET', path: '/health', permissions: ['PUBLIC'], description: 'Health check' },
  { method: 'POST', path: '/auth/login', permissions: ['PUBLIC'], description: 'Login' },
  { method: 'POST', path: '/auth/register', permissions: ['PUBLIC'], description: 'Register' },
  { method: 'POST', path: '/teacher/login', permissions: ['PUBLIC'], description: 'Teacher legacy login' },
  { method: 'POST', path: '/teacher/verify', permissions: ['PUBLIC'], description: 'Teacher legacy verify' },
  { method: 'POST', path: '/admin/verify', permissions: ['PUBLIC'], description: 'Admin verify password' },

  // ============ Authenticated Routes (Any User) ============
  { method: 'POST', path: '/auth/logout', permissions: ['AUTHENTICATED'], description: 'Logout' },
  { method: 'GET', path: '/auth/me', permissions: ['AUTHENTICATED'], description: 'Get current user' },
  { method: 'PUT', path: '/auth/profile', permissions: ['AUTHENTICATED'], description: 'Update profile' },
  { method: 'PUT', path: '/auth/password', permissions: ['AUTHENTICATED'], description: 'Update password' },
  { method: 'POST', path: '/auth/verify', permissions: ['AUTHENTICATED'], description: 'Verify token' },
  { method: 'GET', path: '/sessions', permissions: ['AUTHENTICATED'], description: 'Get chat sessions' },
  { method: 'POST', path: '/sessions', permissions: ['AUTHENTICATED'], description: 'Create chat session' },
  { method: 'GET', path: '/chat/health', permissions: ['PUBLIC'], description: 'AI health check' },
  { method: 'GET', path: '/chat/stream', permissions: ['AUTHENTICATED'], description: 'Chat stream' },
  { method: 'POST', path: '/upload', permissions: ['AUTHENTICATED'], description: 'Upload file' },

  // ============ Student-Only Routes ============
  { method: 'GET', path: '/student/profile', permissions: ['STUDENT'], description: 'Get student profile' },
  { method: 'PUT', path: '/student/profile', permissions: ['STUDENT'], description: 'Update student profile' },
  { method: 'GET', path: '/student/teachers', permissions: ['STUDENT'], description: 'List available teachers' },
  { method: 'PUT', path: '/student/teacher', permissions: ['STUDENT'], description: 'Set student teacher' },
  { method: 'PUT', path: '/student/teachers', permissions: ['STUDENT'], description: 'Set student teachers (multi)' },
  { method: 'GET', path: '/student/lessons', permissions: ['STUDENT'], description: 'Get student lessons' },
  { method: 'POST', path: '/student/lessons/:id/view', permissions: ['STUDENT'], description: 'Mark lesson viewed' },
  { method: 'GET', path: '/student/lesson-chat/stream', permissions: ['STUDENT'], description: 'Lesson chat stream' },
  { method: 'GET', path: '/student/lesson-chat/:lessonId', permissions: ['STUDENT'], description: 'Get lesson chat session' },
  { method: 'GET', path: '/student/homework', permissions: ['STUDENT'], description: 'Get student homework' },
  { method: 'POST', path: '/student/homework/:id/submit', permissions: ['STUDENT'], description: 'Submit homework' },
  { method: 'GET', path: '/student/homework/:id/submission', permissions: ['STUDENT'], description: 'Get homework submission' },
  { method: 'POST', path: '/student/lessons/:lessonId/exit-ticket', permissions: ['STUDENT'], description: 'Generate exit ticket questions' },
  { method: 'POST', path: '/student/lessons/:lessonId/exit-ticket/submit', permissions: ['STUDENT'], description: 'Submit exit ticket answers' },

  // ============ Teacher-Only Routes ============
  { method: 'GET', path: '/teacher/profile', permissions: ['TEACHER'], description: 'Get teacher profile' },
  { method: 'GET', path: '/teacher/classrooms', permissions: ['TEACHER'], description: 'List classrooms' },
  { method: 'POST', path: '/teacher/classrooms', permissions: ['TEACHER'], description: 'Create classroom' },
  { method: 'PATCH', path: '/teacher/classrooms/:id', permissions: ['TEACHER'], description: 'Update classroom' },
  { method: 'DELETE', path: '/teacher/classrooms/:id', permissions: ['TEACHER'], description: 'Delete classroom' },
  { method: 'GET', path: '/teacher/chat/stream', permissions: ['TEACHER'], description: 'Teacher chat stream' },
  { method: 'GET', path: '/teacher/chat/sessions', permissions: ['TEACHER'], description: 'Get teacher chat sessions' },
  { method: 'GET', path: '/teacher/chat/sessions/:id', permissions: ['TEACHER'], description: 'Get teacher chat session' },
  { method: 'POST', path: '/teacher/chat/sessions', permissions: ['TEACHER'], description: 'Create teacher chat session' },
  { method: 'PATCH', path: '/teacher/chat/sessions/:id', permissions: ['TEACHER'], description: 'Update teacher chat session' },
  { method: 'DELETE', path: '/teacher/chat/sessions/:id', permissions: ['TEACHER'], description: 'Delete teacher chat session' },
  { method: 'GET', path: '/teacher/students/activity-summary', permissions: ['TEACHER'], description: 'Get activity summary' },
  { method: 'GET', path: '/teacher/students/:studentId/stats', permissions: ['TEACHER'], description: 'Get student stats' },
  { method: 'GET', path: '/teacher/students/:studentId/lesson-chats', permissions: ['TEACHER'], description: 'Get student lesson chats' },
  { method: 'GET', path: '/teacher/lesson-chats/:sessionId', permissions: ['TEACHER'], description: 'View lesson chat' },
  { method: 'GET', path: '/teacher/homework/pending', permissions: ['TEACHER'], description: 'Get pending submissions' },
  { method: 'GET', path: '/teacher/homework/:homeworkId/submissions', permissions: ['TEACHER'], description: 'Get homework submissions' },
  { method: 'GET', path: '/teacher/homework/submissions/:id', permissions: ['TEACHER'], description: 'Get submission' },
  { method: 'PUT', path: '/teacher/homework/submissions/:id/grade', permissions: ['TEACHER'], description: 'Grade submission' },
  { method: 'POST', path: '/teacher/homework/submissions/:id/regenerate-ai', permissions: ['TEACHER'], description: 'Regenerate AI suggestion' },

  // ============ Lesson Routes (Teacher Only) ============
  { method: 'GET', path: '/lessons', permissions: ['TEACHER'], description: 'List lessons' },
  { method: 'GET', path: '/lessons/:id', permissions: ['TEACHER'], description: 'Get lesson' },
  { method: 'POST', path: '/lessons', permissions: ['TEACHER'], description: 'Create lesson' },
  { method: 'PUT', path: '/lessons/:id', permissions: ['TEACHER'], description: 'Update lesson' },
  { method: 'DELETE', path: '/lessons/:id', permissions: ['TEACHER'], description: 'Delete lesson' },
  { method: 'POST', path: '/lessons/:id/personalize', permissions: ['TEACHER'], description: 'Personalize lesson' },
  { method: 'POST', path: '/lessons/generate-content', permissions: ['TEACHER'], description: 'Generate lesson content' },
  { method: 'GET', path: '/lessons/generate-content/stream', permissions: ['TEACHER'], description: 'Stream lesson content' },
  { method: 'GET', path: '/lessons/:id/progress', permissions: ['TEACHER'], description: 'Get lesson progress' },

  // ============ Homework Routes (Teacher Only) ============
  { method: 'GET', path: '/homework', permissions: ['TEACHER'], description: 'List homework' },
  { method: 'GET', path: '/homework/:id', permissions: ['TEACHER'], description: 'Get homework' },
  { method: 'POST', path: '/homework', permissions: ['TEACHER'], description: 'Create homework' },
  { method: 'PUT', path: '/homework/:id', permissions: ['TEACHER'], description: 'Update homework' },
  { method: 'DELETE', path: '/homework/:id', permissions: ['TEACHER'], description: 'Delete homework' },
  { method: 'POST', path: '/homework/:id/personalize', permissions: ['TEACHER'], description: 'Personalize homework' },
  { method: 'POST', path: '/homework/generate-content', permissions: ['TEACHER'], description: 'Generate homework content' },
  { method: 'GET', path: '/homework/generate-content/stream', permissions: ['TEACHER'], description: 'Stream homework content' },
  { method: 'GET', path: '/homework/:id/progress', permissions: ['TEACHER'], description: 'Get homework progress' },

  // ============ Student Management Routes (Teacher Only) ============
  { method: 'GET', path: '/students', permissions: ['TEACHER'], description: 'List students' },
  { method: 'GET', path: '/students/:id', permissions: ['TEACHER'], description: 'Get student' },
  { method: 'POST', path: '/students', permissions: ['TEACHER'], description: 'Create student' },
  { method: 'PATCH', path: '/students/:id', permissions: ['TEACHER'], description: 'Update student' },
  { method: 'DELETE', path: '/students/:id', permissions: ['TEACHER'], description: 'Delete student' },
  { method: 'GET', path: '/students/:studentId/grades', permissions: ['TEACHER'], description: 'Get student grades' },
  { method: 'POST', path: '/students/:studentId/grades', permissions: ['TEACHER'], description: 'Add grade' },
  { method: 'GET', path: '/students/:studentId/activity', permissions: ['TEACHER'], description: 'Get student activity' },
  { method: 'GET', path: '/students/:studentId/intervention', permissions: ['TEACHER'], description: 'Get intervention status' },

  // ============ Classroom Routes (Teacher Only) ============
  { method: 'GET', path: '/classroom', permissions: ['TEACHER'], description: 'Get classroom overview' },
  { method: 'GET', path: '/classroom/struggling', permissions: ['TEACHER'], description: 'Get struggling students' },
  { method: 'GET', path: '/classroom/:classroomId/subject/:subject/average', permissions: ['TEACHER'], description: 'Get subject average' },

  // ============ Admin Routes ============
  { method: 'GET', path: '/admin/prompt', permissions: ['ADMIN'], description: 'Get system prompt' },
  { method: 'PUT', path: '/admin/prompt', permissions: ['ADMIN'], description: 'Update system prompt' },
  { method: 'POST', path: '/admin/prompt/reset', permissions: ['ADMIN'], description: 'Reset system prompt' },
];

// ============ Helper Functions ============

/**
 * Normalize role to uppercase for case-insensitive comparison
 */
export function normalizeRole(role: string | undefined): UserRole | null {
  if (!role) return null;
  const upper = role.toUpperCase();
  if (upper === 'STUDENT' || upper === 'TEACHER') {
    return upper as UserRole;
  }
  return null;
}

/**
 * Match a request path against a route pattern
 * Handles path parameters like :id, :studentId, etc.
 */
function matchPath(pattern: string, path: string): boolean {
  // Convert route pattern to regex
  // :param -> [^/]+
  const regexStr = pattern
    .replace(/:[^/]+/g, '[^/]+')
    .replace(/\//g, '\\/');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

/**
 * Find the permission entry for a given method and path
 */
export function findRoutePermission(method: string, path: string): RoutePermission | null {
  // Remove /api prefix if present
  const cleanPath = path.replace(/^\/api/, '');

  // Try exact match first
  let match = PERMISSION_REGISTRY.find(
    entry =>
      (entry.method === method.toUpperCase() || entry.method === 'ALL') &&
      matchPath(entry.path, cleanPath)
  );

  return match || null;
}

/**
 * Check if a user has permission to access a route
 */
export function hasPermission(
  user: JwtPayload | undefined,
  permissions: Permission[]
): boolean {
  // PUBLIC routes don't require auth
  if (permissions.includes('PUBLIC')) {
    return true;
  }

  // All other routes require a user
  if (!user) {
    return false;
  }

  // AUTHENTICATED just needs any valid user
  if (permissions.includes('AUTHENTICATED')) {
    return true;
  }

  // Normalize user role for case-insensitive comparison
  const userRole = normalizeRole(user.role);

  // Check role-based permissions
  if (permissions.includes('STUDENT') && userRole === 'STUDENT') {
    return true;
  }
  if (permissions.includes('TEACHER') && userRole === 'TEACHER') {
    return true;
  }
  if (permissions.includes('ADMIN')) {
    // For now, admins are teachers with special flag
    // Future: Add admin role to users table
    return false;
  }

  return false;
}

// ============ Middleware ============

/**
 * Permission checking middleware
 *
 * Validates JWT token and checks route permissions against the registry.
 * Returns 401 for missing/invalid tokens, 403 for insufficient permissions.
 */
export const checkPermission = (
  req: JwtAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const method = req.method;
  const path = req.path;

  // Find permission requirements for this route
  const routePermission = findRoutePermission(method, path);

  // If no permission entry found, deny by default (secure by default)
  if (!routePermission) {
    console.warn(`[Permission] No permission entry for ${method} ${path} - denying access`);
    res.status(403).json({
      error: 'Access denied',
      message: 'This route is not registered in the permission system',
    });
    return;
  }

  // Public routes don't need auth
  if (routePermission.permissions.includes('PUBLIC')) {
    next();
    return;
  }

  // Extract and verify JWT token
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'No authorization header provided',
      code: 'NO_AUTH_HEADER',
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({
      error: 'No token provided',
      code: 'NO_TOKEN',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Attach user to request
    req.user = decoded;

    // Check if user has permission
    if (!hasPermission(decoded, routePermission.permissions)) {
      const userRole = normalizeRole(decoded.role) || 'none';
      console.log(
        `[Permission] Access denied - User role: "${userRole}", Required: ${routePermission.permissions.join(', ')}, Path: ${path}`
      );

      res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of these roles: ${routePermission.permissions.join(', ')}. Your role: ${userRole}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermissions: routePermission.permissions,
        userRole,
      });
      return;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
        message: 'Your authentication token is invalid. Please log in again.',
      });
      return;
    }
    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
    });
  }
};

/**
 * Get a summary of all registered routes and their permissions
 * Useful for debugging and API documentation
 */
export function getPermissionSummary(): Record<string, string[]> {
  const summary: Record<string, string[]> = {};

  for (const entry of PERMISSION_REGISTRY) {
    const key = `${entry.method} ${entry.path}`;
    summary[key] = entry.permissions;
  }

  return summary;
}

/**
 * Validate that all required routes are registered
 * Call this during server startup to catch missing registrations
 */
export function validatePermissionRegistry(router: Router): string[] {
  const warnings: string[] = [];

  // Get all registered routes from Express router
  const stack = (router as any).stack || [];

  for (const layer of stack) {
    if (layer.route) {
      const route = layer.route;
      const methods = Object.keys(route.methods).map(m => m.toUpperCase());
      const path = route.path;

      for (const method of methods) {
        const permission = findRoutePermission(method, path);
        if (!permission) {
          warnings.push(`Route ${method} ${path} is not registered in Permission Registry`);
        }
      }
    }
  }

  return warnings;
}
