import { Router } from 'express';
import { studentController } from '../controllers/student.controller';
import { asyncHandler } from '../middleware/asyncHandler.middleware';
import { teacherAuth } from '../middleware/teacherAuth.middleware';

const router = Router();

// All student routes require teacher authentication
router.use(teacherAuth);

// Get all students (optionally filtered by classroom)
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
