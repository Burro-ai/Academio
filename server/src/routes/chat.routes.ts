import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// SSE streaming endpoint (optionalAuth to get user context for personalization)
router.get('/stream', optionalAuth, asyncHandler(chatController.streamChat));

// Non-streaming endpoint (optionalAuth to get user context for personalization)
router.post('/', optionalAuth, asyncHandler(chatController.sendMessage));

// Ollama health check
router.get('/health', asyncHandler(chatController.healthCheck));

export default router;
