import { Router } from 'express';
import { teacherController } from '../controllers/teacher.controller';
import { teacherChatController } from '../controllers/teacherChat.controller';
import { lessonChatController } from '../controllers/lessonChat.controller';
import { homeworkSubmissionController } from '../controllers/homeworkSubmission.controller';
import { studentController } from '../controllers/student.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { authMiddleware, teacherOnly } from '../middleware/auth.middleware';
import { teacherAuth } from '../middleware/teacherAuth.middleware';

const router = Router();

// Public routes (no auth required)
router.post('/verify', asyncHandler(teacherController.verify));
router.post('/login', asyncHandler(teacherController.login));

// Protected routes (require JWT teacher authentication)
// Use JWT auth for most routes, fallback to legacy password auth for compatibility
router.use((req, res, next) => {
  // Try JWT auth first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ey')) {
    // Looks like a JWT token, use JWT middleware
    return authMiddleware(req, res, (err) => {
      if (err) return next(err);
      return teacherOnly(req, res, next);
    });
  }
  // Fallback to legacy password auth
  return teacherAuth(req, res, next);
});

// Teacher profile
router.get('/profile', asyncHandler(teacherController.getProfile));

// Classrooms
router.get('/classrooms', asyncHandler(teacherController.getClassrooms));
router.post('/classrooms', asyncHandler(teacherController.createClassroom));
router.patch('/classrooms/:id', asyncHandler(teacherController.updateClassroom));
router.delete('/classrooms/:id', asyncHandler(teacherController.deleteClassroom));

// Teacher Chat (AI Assistant)
router.get('/chat/stream', asyncHandler(teacherChatController.streamChat));
router.get('/chat/sessions', asyncHandler(teacherChatController.getSessions));
router.get('/chat/sessions/:id', asyncHandler(teacherChatController.getSession));
router.post('/chat/sessions', asyncHandler(teacherChatController.createSession));
router.patch('/chat/sessions/:id', asyncHandler(teacherChatController.updateSession));
router.delete('/chat/sessions/:id', asyncHandler(teacherChatController.deleteSession));

// Student Stats (360-Degree View)
router.get('/students/activity-summary', asyncHandler(studentController.getActivitySummary));
router.get('/students/:studentId/stats', asyncHandler(studentController.getStudentStats));

// Student Lesson Chats (Teacher Oversight)
router.get('/students/:studentId/lesson-chats', asyncHandler(lessonChatController.getStudentLessonChats));
router.get('/lesson-chats/:sessionId', asyncHandler(lessonChatController.viewLessonChat));

// Homework Submissions (Grading)
router.get('/homework/pending', asyncHandler(homeworkSubmissionController.getPending));
router.get('/homework/:homeworkId/submissions', asyncHandler(homeworkSubmissionController.getAllByHomework));
router.get('/homework/submissions/:id', asyncHandler(homeworkSubmissionController.getSubmission));
router.put('/homework/submissions/:id/grade', asyncHandler(homeworkSubmissionController.grade));
router.post('/homework/submissions/:id/regenerate-ai', asyncHandler(homeworkSubmissionController.regenerateAISuggestion));

export default router;
