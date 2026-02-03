import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { teacherAuth } from '../middleware/teacherAuth.middleware';

const router = Router();

// All classroom routes require teacher authentication
router.use(teacherAuth);

// Get classroom overview (all classrooms with stats or single classroom)
router.get('/', asyncHandler(classroomController.getOverview));

// Get students needing intervention
router.get('/struggling', asyncHandler(classroomController.getStrugglingStudents));

// Get subject average for a classroom
router.get('/:id/subject/:subject/average', asyncHandler(classroomController.getSubjectAverage));

export default router;
