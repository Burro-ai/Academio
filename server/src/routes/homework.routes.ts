import { Router } from 'express';
import { homeworkController } from '../controllers/homework.controller';
import { authMiddleware, teacherOnly } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler.middleware';

const router = Router();

// All routes require authentication and teacher role
router.use(authMiddleware, teacherOnly);

// Get all homework for current teacher
router.get('/', asyncHandler(homeworkController.getHomework));

// Generate master content using AI
router.post('/generate-content', asyncHandler(homeworkController.generateContent));

// Get homework by ID
router.get('/:id', asyncHandler(homeworkController.getHomeworkById));

// Create new homework
router.post('/', asyncHandler(homeworkController.createHomework));

// Update homework
router.put('/:id', asyncHandler(homeworkController.updateHomework));

// Delete homework
router.delete('/:id', asyncHandler(homeworkController.deleteHomework));

// Personalize homework for all students
router.post('/:id/personalize', asyncHandler(homeworkController.personalizeHomework));

export default router;
