import { Router } from 'express';
import { studentPortalController } from '../controllers/studentPortal.controller';
import { authMiddleware, studentOnly } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler.middleware';

const router = Router();

// All routes require authentication and student role
router.use(authMiddleware, studentOnly);

// Profile
router.get('/profile', asyncHandler(studentPortalController.getProfile));
router.put('/profile', asyncHandler(studentPortalController.updateProfile));

// Teachers (for student to find and select their teacher)
router.get('/teachers', asyncHandler(studentPortalController.getTeachers));
router.put('/teacher', asyncHandler(studentPortalController.setTeacher));

// Lessons
router.get('/lessons', asyncHandler(studentPortalController.getLessons));
router.post('/lessons/:id/view', asyncHandler(studentPortalController.markLessonViewed));

// Homework
router.get('/homework', asyncHandler(studentPortalController.getHomework));
router.post('/homework/:id/submit', asyncHandler(studentPortalController.submitHomework));

export default router;
