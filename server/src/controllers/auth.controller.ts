import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { usersQueries } from '../database/queries/users.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import {
  LoginRequest,
  RegisterRequest,
  JwtPayload,
  JwtAuthenticatedRequest,
} from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

/**
 * Generate JWT token for user
 * Includes schoolId for multi-school validation and scoping
 */
const generateToken = (user: {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
  schoolId?: string;
}): string => {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId, // Include for RAG and multi-school scoping
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '7d', // 7 days
  });
};

/**
 * Get redirect path based on user role
 */
const getRedirectPath = (role: 'STUDENT' | 'TEACHER'): string => {
  return role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';
};

export const authController = {
  /**
   * POST /api/auth/register
   * Register a new user
   */
  async register(req: Request, res: Response) {
    const { email, password, name, role } = req.body as RegisterRequest;

    // Validation
    if (!email || !password || !name || !role) {
      throw new AppError('Email, password, name, and role are required', 400);
    }

    if (!['STUDENT', 'TEACHER'].includes(role)) {
      throw new AppError('Role must be STUDENT or TEACHER', 400);
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    // Check if email already exists
    if (usersQueries.emailExists(email)) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = usersQueries.create({
      email,
      passwordHash,
      role,
      name,
    });

    // If student, create profile
    if (role === 'STUDENT') {
      studentProfilesQueries.create(user.id);
    }

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
        schoolId: user.schoolId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
      redirectTo: getRedirectPath(user.role),
    });
  },

  /**
   * POST /api/auth/login
   * Login user
   */
  async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginRequest;

    // Validation
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Find user
    const user = usersQueries.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
        schoolId: user.schoolId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
      redirectTo: getRedirectPath(user.role),
    });
  },

  /**
   * POST /api/auth/logout
   * Logout user (client-side token removal)
   */
  async logout(_req: Request, res: Response) {
    // JWT is stateless, so we just send success
    // Client is responsible for removing the token
    res.json({ message: 'Logged out successfully' });
  },

  /**
   * GET /api/auth/me
   * Get current authenticated user
   */
  async me(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const user = usersQueries.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // If student, include profile data
    let profile = null;
    if (user.role === 'STUDENT') {
      profile = studentProfilesQueries.getByUserId(user.id);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
        schoolId: user.schoolId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile,
    });
  },

  /**
   * PUT /api/auth/profile
   * Update current user's profile
   */
  async updateProfile(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { name, avatarUrl } = req.body;

    const user = usersQueries.update(req.user.id, {
      name,
      avatarUrl,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
        schoolId: user.schoolId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  },

  /**
   * PUT /api/auth/password
   * Update current user's password
   */
  async updatePassword(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters', 400);
    }

    // Verify current password
    const user = usersQueries.findByEmail(req.user.email);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    usersQueries.updatePassword(req.user.id, newPasswordHash);

    res.json({ message: 'Password updated successfully' });
  },

  /**
   * POST /api/auth/verify
   * Verify if token is valid
   */
  async verify(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const user = usersQueries.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        schoolId: user.schoolId,
      },
    });
  },
};
