import { Router } from 'express';
import chatRoutes from './chat.routes';
import sessionRoutes from './session.routes';
import uploadRoutes from './upload.routes';
import adminRoutes from './admin.routes';
import teacherRoutes from './teacher.routes';
import studentRoutes from './student.routes';
import classroomRoutes from './classroom.routes';

const router = Router();

// Health check at /api/health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Student Interface routes
router.use('/chat', chatRoutes);
router.use('/sessions', sessionRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);

// Teacher Interface routes
router.use('/teacher', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/classroom', classroomRoutes);

export default router;
