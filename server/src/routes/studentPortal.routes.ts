import { Router } from 'express';
import { studentPortalController } from '../controllers/studentPortal.controller';
import { lessonChatController } from '../controllers/lessonChat.controller';
import { homeworkSubmissionController } from '../controllers/homeworkSubmission.controller';
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

// Lesson Chat (Interactive AI Tutoring)
router.get('/lesson-chat/stream', asyncHandler(lessonChatController.stream));
router.get('/lesson-chat/:lessonId', asyncHandler(lessonChatController.getSession));

// Homework
router.get('/homework', asyncHandler(studentPortalController.getHomework));

// Homework Submissions (Structured Form Submission)
router.post('/homework/:id/submit', asyncHandler(homeworkSubmissionController.submit));
router.get('/homework/:id/submission', asyncHandler(homeworkSubmissionController.getStudentSubmission));

export default router;
