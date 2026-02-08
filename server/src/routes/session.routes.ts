import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Get all sessions for authenticated user
router.get('/', authMiddleware, asyncHandler(sessionController.getAll));

// Get single session with messages (requires auth to verify ownership)
router.get('/:id', optionalAuth, asyncHandler(sessionController.getById));

// Create new session (requires auth to link to user)
router.post('/', authMiddleware, asyncHandler(sessionController.create));

// Update session (requires auth)
router.patch('/:id', authMiddleware, asyncHandler(sessionController.update));

// Delete session (requires auth)
router.delete('/:id', authMiddleware, asyncHandler(sessionController.delete));

export default router;
