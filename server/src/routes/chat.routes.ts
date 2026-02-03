import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';

const router = Router();

// SSE streaming endpoint
router.get('/stream', asyncHandler(chatController.streamChat));

// Non-streaming endpoint
router.post('/', asyncHandler(chatController.sendMessage));

// Ollama health check
router.get('/health', asyncHandler(chatController.healthCheck));

export default router;
