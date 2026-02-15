import { Response } from 'express';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { homeworkQueries } from '../database/queries/homework.queries';
import { usersQueries } from '../database/queries/users.queries';
import { JwtAuthenticatedRequest, UpdateStudentProfileRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const studentPortalController = {
  /**
   * GET /api/student/profile
   * Get current student's profile
   */
  async getProfile(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const profile = studentProfilesQueries.getWithUserDetails(req.user.id);
    if (!profile) {
      throw new AppError('Profile not found', 404);
    }

    res.json(profile);
  },

  /**
   * PUT /api/student/profile
   * Update current student's profile
   */
  async updateProfile(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const data = req.body as UpdateStudentProfileRequest;

    // Check if profile exists, create if not
    let profile = studentProfilesQueries.getByUserId(req.user.id);
    if (!profile) {
      profile = studentProfilesQueries.create(req.user.id, data);
    } else {
      profile = studentProfilesQueries.update(req.user.id, data);
    }

    res.json(profile);
  },

  /**
   * GET /api/student/lessons
   * Get personalized lessons for current student
   */
  async getLessons(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const lessons = lessonsQueries.getPersonalizedByStudentId(req.user.id);
    res.json(lessons);
  },

  /**
   * POST /api/student/lessons/:id/view
   * Mark a lesson as viewed
   */
  async markLessonViewed(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify this lesson belongs to the student
    const lessons = lessonsQueries.getPersonalizedByStudentId(req.user.id);
    const lesson = lessons.find((l) => l.id === id);
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    lessonsQueries.markAsViewed(id);
    res.json({ message: 'Lesson marked as viewed' });
  },

  /**
   * GET /api/student/homework
   * Get personalized homework for current student
   */
  async getHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const homework = homeworkQueries.getPersonalizedByStudentId(req.user.id);
    res.json(homework);
  },

  /**
   * POST /api/student/homework/:id/submit
   * Mark homework as submitted
   */
  async submitHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify this homework belongs to the student
    const allHomework = homeworkQueries.getPersonalizedByStudentId(req.user.id);
    const homework = allHomework.find((h) => h.id === id);
    if (!homework) {
      throw new AppError('Homework not found', 404);
    }

    homeworkQueries.markAsSubmitted(id);
    res.json({ message: 'Homework submitted' });
  },

  /**
   * GET /api/student/teachers
   * Get all available teachers for student to select
   */
  async getTeachers(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const teachers = usersQueries.findAllTeachers();
    res.json(teachers);
  },

  /**
   * PUT /api/student/teacher
   * Set the student's selected teacher
   */
  async setTeacher(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { teacherId } = req.body;

    // Validate teacher exists if teacherId provided
    if (teacherId) {
      const teacher = usersQueries.findById(teacherId);
      if (!teacher || teacher.role !== 'TEACHER') {
        throw new AppError('Teacher not found', 404);
      }
    }

    // Check if profile exists, create if not
    let profile = studentProfilesQueries.getByUserId(req.user.id);
    if (!profile) {
      profile = studentProfilesQueries.create(req.user.id, {});
    }

    // Update teacher
    profile = studentProfilesQueries.setTeacher(req.user.id, teacherId || null);
    res.json(profile);
  },

  /**
   * PUT /api/student/teachers
   * Set the student's selected teachers (multiple)
   */
  async setTeachers(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { teacherIds } = req.body;

    if (!Array.isArray(teacherIds)) {
      throw new AppError('teacherIds must be an array', 400);
    }

    // Validate all teachers exist
    for (const teacherId of teacherIds) {
      const teacher = usersQueries.findById(teacherId);
      if (!teacher || teacher.role !== 'TEACHER') {
        throw new AppError(`Teacher not found: ${teacherId}`, 404);
      }
    }

    // Check if profile exists, create if not
    let profile = studentProfilesQueries.getByUserId(req.user.id);
    if (!profile) {
      profile = studentProfilesQueries.create(req.user.id, {});
    }

    // Update teachers
    profile = studentProfilesQueries.setTeachers(req.user.id, teacherIds);
    res.json(profile);
  },
};
