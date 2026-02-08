import { Router } from 'express';
import { lessonController } from '../controllers/lesson.controller';
import { authMiddleware, teacherOnly } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler.middleware';

const router = Router();

// All routes require authentication and teacher role
router.use(authMiddleware, teacherOnly);

// Get all lessons for current teacher
router.get('/', asyncHandler(lessonController.getLessons));

// Generate master content using AI (non-streaming)
router.post('/generate-content', asyncHandler(lessonController.generateContent));

// Generate master content using AI (streaming SSE)
router.get('/generate-content/stream', asyncHandler(lessonController.streamGenerateContent));

// Get lesson by ID
router.get('/:id', asyncHandler(lessonController.getLesson));

// Create a new lesson
router.post('/', asyncHandler(lessonController.createLesson));

// Update a lesson
router.put('/:id', asyncHandler(lessonController.updateLesson));

// Delete a lesson
router.delete('/:id', asyncHandler(lessonController.deleteLesson));

// Get personalization progress
router.get('/:id/progress', asyncHandler(lessonController.getProgress));

// Personalize lesson for all students
router.post('/:id/personalize', asyncHandler(lessonController.personalizeLesson));

export default router;
