import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';

const router = Router();

// Get all sessions
router.get('/', asyncHandler(sessionController.getAll));

// Get single session with messages
router.get('/:id', asyncHandler(sessionController.getById));

// Create new session
router.post('/', asyncHandler(sessionController.create));

// Update session
router.patch('/:id', asyncHandler(sessionController.update));

// Delete session
router.delete('/:id', asyncHandler(sessionController.delete));

export default router;
