import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from './errorHandler.middleware';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Authorization header required', 401);
  }

  // Simple password-based auth for MVP
  // Format: "Bearer <password>"
  const [type, password] = authHeader.split(' ');

  if (type !== 'Bearer' || password !== config.adminPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  next();
};
