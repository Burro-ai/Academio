import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/asyncHandler.middleware';

const router = Router();

// Public routes (unified auth)
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));

// Protected routes
router.get('/me', authMiddleware, asyncHandler(authController.me));
router.put('/profile', authMiddleware, asyncHandler(authController.updateProfile));
router.put('/password', authMiddleware, asyncHandler(authController.updatePassword));
router.post('/verify', authMiddleware, asyncHandler(authController.verify));

export default router;
