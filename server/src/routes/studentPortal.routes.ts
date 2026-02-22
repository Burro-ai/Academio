import { Router } from 'express';
import { studentPortalController } from '../controllers/studentPortal.controller';
import { lessonChatController } from '../controllers/lessonChat.controller';
import { homeworkChatController } from '../controllers/homeworkChat.controller';
import { homeworkSubmissionController } from '../controllers/homeworkSubmission.controller';
import { exitTicketController } from '../controllers/exitTicket.controller';
import { authMiddleware, studentOnly } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler.middleware';

const router = Router();

// All routes require authentication and student role
router.use(authMiddleware, studentOnly);

// Profile
router.get('/profile', asyncHandler(studentPortalController.getProfile));
router.put('/profile', asyncHandler(studentPortalController.updateProfile));

// Teachers (for student to find and select their teachers)
router.get('/teachers', asyncHandler(studentPortalController.getTeachers));
router.put('/teacher', asyncHandler(studentPortalController.setTeacher));
router.put('/teachers', asyncHandler(studentPortalController.setTeachers));

// Lessons
router.get('/lessons', asyncHandler(studentPortalController.getLessons));
router.post('/lessons/:id/view', asyncHandler(studentPortalController.markLessonViewed));

// Exit Ticket (Comprehension Verification before marking lesson complete)
router.post('/lessons/:lessonId/exit-ticket', asyncHandler(exitTicketController.generate));
router.post('/lessons/:lessonId/exit-ticket/submit', asyncHandler(exitTicketController.submit));

// Lesson Chat (Interactive AI Tutoring)
router.get('/lesson-chat/stream', asyncHandler(lessonChatController.stream));
router.get('/lesson-chat/:lessonId', asyncHandler(lessonChatController.getSession));
router.post('/lesson-chat/:lessonId/personalize', asyncHandler(lessonChatController.personalizeLesson));

// Homework
router.get('/homework', asyncHandler(studentPortalController.getHomework));

// Homework Chat (Socratic Sidekick AI)
router.get('/homework-chat/stream', asyncHandler(homeworkChatController.stream));
router.get('/homework-chat/:homeworkId', asyncHandler(homeworkChatController.getSession));

// Homework Submissions (Structured Form Submission)
router.post('/homework/:id/submit', asyncHandler(homeworkSubmissionController.submit));
router.get('/homework/:id/submission', asyncHandler(homeworkSubmissionController.getStudentSubmission));

export default router;
