import { Router } from 'express';
import { teacherController } from '../controllers/teacher.controller';
import { teacherChatController } from '../controllers/teacherChat.controller';
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

export default router;
