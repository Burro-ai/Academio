import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtAuthenticatedRequest, JwtPayload, UserRole } from '../types';

/**
 * Normalize role to uppercase for case-insensitive comparison
 * Handles both "teacher"/"TEACHER" and "student"/"STUDENT" variants
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
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header and attaches user info to request
 *
 * Returns structured error responses with error codes for client handling:
 * - NO_AUTH_HEADER: Missing Authorization header
 * - NO_TOKEN: Empty token
 * - TOKEN_EXPIRED: Token has expired (triggers logout on client)
 * - TOKEN_INVALID: Token is malformed or signature invalid
 * - AUTH_FAILED: Generic auth failure
 */
export const authMiddleware = (
  req: JwtAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
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

    // Normalize role in the decoded payload for consistency
    if (decoded.role) {
      decoded.role = normalizeRole(decoded.role) || decoded.role;
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Include X-Token-Expired header for client-side detection
      res.setHeader('X-Token-Expired', 'true');
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
 * Role-based Authorization Middleware Factory
 * Creates middleware that checks if user has required role(s)
 * Uses case-insensitive comparison to handle role string variations
 *
 * @param allowedRoles - Array of roles that can access the route
 * @returns Express middleware function
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (
    req: JwtAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Normalize role comparison to uppercase for case-insensitivity
    const userRole = normalizeRole(req.user.role);
    const normalizedAllowedRoles = allowedRoles.map(r => normalizeRole(r) || r.toUpperCase());

    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      console.log(
        `[Auth] Role mismatch - User role: "${req.user.role}" (normalized: "${userRole}"), ` +
        `Required: ${allowedRoles.join(', ')}, Path: ${req.path}`
      );

      res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}. Your role: ${userRole || 'none'}`,
        requiredRoles: allowedRoles,
        userRole: userRole || 'none',
      });
      return;
    }

    next();
  };
};

/**
 * Teacher-only middleware
 * Shorthand for requireRole('TEACHER')
 */
export const teacherOnly = requireRole('TEACHER');

/**
 * Student-only middleware
 * Shorthand for requireRole('STUDENT')
 */
export const studentOnly = requireRole('STUDENT');

/**
 * Optional auth middleware - attaches user if token present, but doesn't require it
 * Useful for routes that behave differently based on auth state
 */
export const optionalAuth = (
  req: JwtAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Normalize role in the decoded payload
    if (decoded.role) {
      decoded.role = normalizeRole(decoded.role) || decoded.role;
    }

    req.user = decoded;
  } catch {
    // Token invalid but that's ok for optional auth - continue without user
  }

  next();
};

/**
 * Multi-school validation middleware
 * Validates that the school_id in the request matches the token's scope
 *
 * @param schoolIdField - The field name containing school_id (default: 'schoolId')
 */
export const validateSchoolScope = (schoolIdField: string = 'schoolId') => {
  return (
    req: JwtAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Get school ID from request (body, query, or params)
    const requestSchoolId =
      req.body?.[schoolIdField] ||
      req.query?.[schoolIdField] ||
      req.params?.[schoolIdField];

    // If no school ID in request, skip validation
    if (!requestSchoolId) {
      next();
      return;
    }

    // If user has no school context in token, they can access any school
    // (Super admin or unassigned user)
    if (!req.user.schoolId) {
      next();
      return;
    }

    // Validate school ID matches token scope
    if (requestSchoolId !== req.user.schoolId) {
      console.log(
        `[Auth] School scope mismatch - Request: "${requestSchoolId}", ` +
        `Token: "${req.user.schoolId}", User: ${req.user.email}`
      );

      res.status(403).json({
        error: 'Access denied',
        code: 'SCHOOL_SCOPE_MISMATCH',
        message: 'You do not have access to this school\'s resources.',
      });
      return;
    }

    next();
  };
};

/**
 * Combined auth + role middleware for convenience
 * Use when you need both authentication and role checking
 */
export const authWithRole = (...roles: UserRole[]) => {
  return [authMiddleware, requireRole(...roles)];
};

/**
 * Extract user ID from request with validation
 * Useful helper for controllers that need the authenticated user's ID
 */
export const getUserId = (req: JwtAuthenticatedRequest): string | null => {
  return req.user?.id || null;
};

/**
 * Extract normalized role from request
 */
export const getUserRole = (req: JwtAuthenticatedRequest): UserRole | null => {
  return normalizeRole(req.user?.role) || null;
};
