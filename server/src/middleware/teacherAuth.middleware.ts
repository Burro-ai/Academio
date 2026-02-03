import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from './errorHandler.middleware';

/**
 * Teacher authentication middleware
 * For MVP: Simple password-based auth via Bearer token
 * Future: JWT or session-based authentication
 */
export const teacherAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Authorization header required', 401);
  }

  // Simple password-based auth for MVP
  // Format: "Bearer <password>"
  const [type, password] = authHeader.split(' ');

  if (type !== 'Bearer' || password !== config.teacherPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  // In the future, we could attach teacher info to the request
  // (req as any).teacher = { ... };

  next();
};

/**
 * Optional teacher auth - allows unauthenticated requests but attaches teacher info if available
 */
export const optionalTeacherAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const [type, password] = authHeader.split(' ');
    if (type === 'Bearer' && password === config.teacherPassword) {
      // Authenticated - could attach teacher info here
      // (req as any).isTeacher = true;
    }
  }

  next();
};
