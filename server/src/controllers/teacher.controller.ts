import { Request, Response } from 'express';
import { teachersQueries } from '../database/queries/teachers.queries';
import { classroomsQueries } from '../database/queries/classrooms.queries';
import { TeacherLoginRequest, CreateClassroomRequest, UpdateClassroomRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';
import { config } from '../config';

export const teacherController = {
  /**
   * Verify teacher credentials (simple password for MVP)
   * POST /api/teacher/verify
   */
  async verify(req: Request, res: Response) {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Password is required', 400);
    }

    if (password !== config.teacherPassword) {
      throw new AppError('Invalid password', 401);
    }

    res.json({ success: true, message: 'Authenticated' });
  },

  /**
   * Login with email/password (for future multi-teacher support)
   * POST /api/teacher/login
   */
  async login(req: Request, res: Response) {
    const { email, password } = req.body as TeacherLoginRequest;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const teacher = teachersQueries.verifyCredentials(email, password);
    if (!teacher) {
      throw new AppError('Invalid credentials', 401);
    }

    // For MVP, return simple token (password-based)
    // In production, use JWT
    res.json({
      teacher,
      token: config.teacherPassword, // Simplified for MVP
    });
  },

  /**
   * Get teacher profile
   * GET /api/teacher/profile
   */
  async getProfile(req: Request, res: Response) {
    // For MVP, return a default teacher profile
    // In production, get from authenticated request
    const teachers = teachersQueries.getAll();

    if (teachers.length === 0) {
      // Create a default teacher
      const defaultTeacher = teachersQueries.create(
        'Default Teacher',
        'teacher@academio.com',
        config.teacherPassword
      );
      res.json(defaultTeacher);
      return;
    }

    res.json(teachers[0]);
  },

  /**
   * Get teacher's classrooms
   * GET /api/teacher/classrooms
   */
  async getClassrooms(req: Request, res: Response) {
    // For MVP, get classrooms for first teacher
    const teachers = teachersQueries.getAll();
    if (teachers.length === 0) {
      res.json([]);
      return;
    }

    const classrooms = classroomsQueries.getByTeacherId(teachers[0].id);
    res.json(classrooms);
  },

  /**
   * Create a classroom
   * POST /api/teacher/classrooms
   */
  async createClassroom(req: Request, res: Response) {
    const { name, subject, gradeLevel } = req.body as CreateClassroomRequest;

    if (!name) {
      throw new AppError('Classroom name is required', 400);
    }

    // Get teacher ID
    let teachers = teachersQueries.getAll();
    if (teachers.length === 0) {
      // Create default teacher
      teachersQueries.create('Default Teacher', 'teacher@academio.com', config.teacherPassword);
      teachers = teachersQueries.getAll();
    }

    const classroom = classroomsQueries.create({
      name,
      teacherId: teachers[0].id,
      subject,
      gradeLevel,
    });

    res.status(201).json(classroom);
  },

  /**
   * Update a classroom
   * PATCH /api/teacher/classrooms/:id
   */
  async updateClassroom(req: Request, res: Response) {
    const { id } = req.params;
    const { name, subject, gradeLevel } = req.body as UpdateClassroomRequest;

    const classroom = classroomsQueries.update(id, { name, subject, gradeLevel });
    if (!classroom) {
      throw new AppError('Classroom not found', 404);
    }

    res.json(classroom);
  },

  /**
   * Delete a classroom
   * DELETE /api/teacher/classrooms/:id
   */
  async deleteClassroom(req: Request, res: Response) {
    const { id } = req.params;

    const deleted = classroomsQueries.delete(id);
    if (!deleted) {
      throw new AppError('Classroom not found', 404);
    }

    res.status(204).send();
  },
};
