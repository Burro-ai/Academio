import { Router } from 'express';
import { studentController } from '../controllers/student.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { authMiddleware, teacherOnly } from '../middleware/auth.middleware';

const router = Router();

// All student routes use JWT auth for teachers
router.use(authMiddleware, teacherOnly);

// Get all students - returns students who selected this teacher
router.get('/', asyncHandler(studentController.getAll));

// Get a single student with full profile
router.get('/:id', asyncHandler(studentController.getById));

// Get student grades
router.get('/:id/grades', asyncHandler(studentController.getGrades));

// Add a grade for a student
router.post('/:id/grades', asyncHandler(studentController.addGrade));

// Get student learning activity
router.get('/:id/activity', asyncHandler(studentController.getActivity));

// Get intervention recommendation
router.get('/:id/intervention', asyncHandler(studentController.getIntervention));

// Create a new student
router.post('/', asyncHandler(studentController.create));

// Update a student
router.patch('/:id', asyncHandler(studentController.update));

// Delete a student
router.delete('/:id', asyncHandler(studentController.delete));

export default router;
