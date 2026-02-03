import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { adminAuth } from '../middleware/adminAuth.middleware';
import { asyncHandler } from '../middleware/asyncHandler.middleware';

const router = Router();

// All admin routes require authentication
router.use(adminAuth);

// Verify authentication
router.get('/verify', asyncHandler(adminController.verifyAuth));

// Get current system prompt
router.get('/prompt', asyncHandler(adminController.getPrompt));

// Update system prompt
router.put('/prompt', asyncHandler(adminController.updatePrompt));

// Reset to default prompt
router.post('/prompt/reset', asyncHandler(adminController.resetPrompt));

export default router;
