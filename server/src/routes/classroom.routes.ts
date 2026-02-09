import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { authMiddleware, teacherOnly } from '../middleware/auth.middleware';

const router = Router();

// All classroom routes require JWT teacher authentication
router.use(authMiddleware, teacherOnly);

// Get classroom overview (all classrooms with stats or single classroom)
router.get('/', asyncHandler(classroomController.getOverview));

// Get students needing intervention
router.get('/struggling', asyncHandler(classroomController.getStrugglingStudents));

// Create a new classroom
router.post('/', asyncHandler(classroomController.createClassroom));

// Update a classroom
router.put('/:id', asyncHandler(classroomController.updateClassroom));

// Delete a classroom
router.delete('/:id', asyncHandler(classroomController.deleteClassroom));

// Get subject average for a classroom
router.get('/:id/subject/:subject/average', asyncHandler(classroomController.getSubjectAverage));

export default router;
