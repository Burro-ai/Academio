import { Router } from 'express';
import chatRoutes from './chat.routes';
import sessionRoutes from './session.routes';
import uploadRoutes from './upload.routes';
import adminRoutes from './admin.routes';
import teacherRoutes from './teacher.routes';
import studentRoutes from './student.routes';
import classroomRoutes from './classroom.routes';
import authRoutes from './auth.routes';
import lessonRoutes from './lesson.routes';
import homeworkRoutes from './homework.routes';
import studentPortalRoutes from './studentPortal.routes';

const router = Router();

// Health check at /api/health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Unified Authentication routes
router.use('/auth', authRoutes);

// Student Interface routes (legacy)
router.use('/chat', chatRoutes);
router.use('/sessions', sessionRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);

// Teacher Interface routes (legacy)
router.use('/teacher', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/classroom', classroomRoutes);

// New JWT-authenticated routes
router.use('/lessons', lessonRoutes);
router.use('/homework', homeworkRoutes);
router.use('/student', studentPortalRoutes);

export default router;
