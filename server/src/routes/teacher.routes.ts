import { Router } from 'express';
import { teacherController } from '../controllers/teacher.controller';
import { teacherChatController } from '../controllers/teacherChat.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { teacherAuth } from '../middleware/teacherAuth.middleware';

const router = Router();

// Public routes (no auth required)
router.post('/verify', asyncHandler(teacherController.verify));
router.post('/login', asyncHandler(teacherController.login));

// Protected routes (require teacher auth)
router.use(teacherAuth);

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
