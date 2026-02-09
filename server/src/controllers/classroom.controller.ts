import { Request, Response } from 'express';
import { classroomService } from '../services/classroom.service';
import { teachersQueries } from '../database/queries/teachers.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { Subject, JwtAuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const classroomController = {
  /**
   * Get classroom overview with statistics
   * GET /api/classroom
   */
  async getOverview(req: Request, res: Response) {
    const jwtReq = req as JwtAuthenticatedRequest;
    const { classroomId } = req.query;

    if (!classroomId || typeof classroomId !== 'string') {
      // If JWT authenticated teacher, count students who selected this teacher
      if (jwtReq.user && jwtReq.user.role === 'TEACHER') {
        const myStudents = studentProfilesQueries.getByTeacherId(jwtReq.user.id);
        const classrooms = classroomService.getClassroomsByTeacher(jwtReq.user.id);
        const classroomsWithStats = classrooms.map(c => ({
          ...c,
          stats: classroomService.getClassroomStats(c.id),
        }));

        res.json({
          classrooms: classroomsWithStats,
          totalStudents: myStudents.length,
          studentsStruggling: myStudents.filter(s => {
            // Consider struggling if they have a high struggle score or need intervention
            return false; // TODO: Calculate from learning analytics
          }).length,
          studentsExcelling: 0,
          recentActivity: 0,
        });
        return;
      }

      // Fallback: Return aggregated stats for all teacher's classrooms (legacy)
      const teachers = teachersQueries.getAll();
      if (teachers.length === 0) {
        res.json({
          classrooms: [],
          totalStudents: 0,
          studentsStruggling: 0,
        });
        return;
      }

      const classrooms = classroomService.getClassroomsByTeacher(teachers[0].id);
      const classroomsWithStats = classrooms.map(c => ({
        ...c,
        stats: classroomService.getClassroomStats(c.id),
      }));

      const totals = classroomsWithStats.reduce(
        (acc, c) => ({
          totalStudents: acc.totalStudents + c.stats.totalStudents,
          studentsStruggling: acc.studentsStruggling + c.stats.studentsStruggling,
          studentsExcelling: acc.studentsExcelling + c.stats.studentsExcelling,
          recentActivity: acc.recentActivity + c.stats.recentActivity,
        }),
        { totalStudents: 0, studentsStruggling: 0, studentsExcelling: 0, recentActivity: 0 }
      );

      res.json({
        classrooms: classroomsWithStats,
        ...totals,
      });
      return;
    }

    const classroom = classroomService.getClassroom(classroomId);
    if (!classroom) {
      throw new AppError('Classroom not found', 404);
    }

    const stats = classroomService.getClassroomStats(classroomId);

    res.json({
      classroom,
      stats,
    });
  },

  /**
   * Get students needing intervention
   * GET /api/classroom/struggling
   */
  async getStrugglingStudents(req: Request, res: Response) {
    const teachers = teachersQueries.getAll();
    if (teachers.length === 0) {
      res.json([]);
      return;
    }

    const alerts = classroomService.getStudentsNeedingIntervention(teachers[0].id);
    res.json(alerts);
  },

  /**
   * Get subject average for a classroom
   * GET /api/classroom/:id/subject/:subject/average
   */
  async getSubjectAverage(req: Request, res: Response) {
    const { id, subject } = req.params;

    const validSubjects = ['math', 'science', 'history', 'geography', 'english', 'writing', 'general'];
    if (!validSubjects.includes(subject)) {
      throw new AppError(`Invalid subject. Must be one of: ${validSubjects.join(', ')}`, 400);
    }

    const average = classroomService.getSubjectAverage(id, subject as Subject);

    res.json({
      classroomId: id,
      subject,
      average: Math.round(average * 10) / 10,
    });
  },

  /**
   * Create a new classroom
   * POST /api/classroom
   */
  async createClassroom(req: Request, res: Response) {
    const jwtReq = req as JwtAuthenticatedRequest;
    if (!jwtReq.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { name, subject, gradeLevel } = req.body;

    if (!name) {
      throw new AppError('Classroom name is required', 400);
    }

    const classroom = classroomService.createClassroom({
      name,
      teacherId: jwtReq.user.id,
      subject,
      gradeLevel,
    });

    res.status(201).json(classroom);
  },

  /**
   * Update a classroom
   * PUT /api/classroom/:id
   */
  async updateClassroom(req: Request, res: Response) {
    const jwtReq = req as JwtAuthenticatedRequest;
    if (!jwtReq.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;
    const { name, subject, gradeLevel } = req.body;

    // Verify ownership
    const existing = classroomService.getClassroom(id);
    if (!existing) {
      throw new AppError('Classroom not found', 404);
    }
    if (existing.teacherId !== jwtReq.user.id) {
      throw new AppError('Not authorized to update this classroom', 403);
    }

    const classroom = classroomService.updateClassroom(id, { name, subject, gradeLevel });
    res.json(classroom);
  },

  /**
   * Delete a classroom
   * DELETE /api/classroom/:id
   */
  async deleteClassroom(req: Request, res: Response) {
    const jwtReq = req as JwtAuthenticatedRequest;
    if (!jwtReq.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify ownership
    const existing = classroomService.getClassroom(id);
    if (!existing) {
      throw new AppError('Classroom not found', 404);
    }
    if (existing.teacherId !== jwtReq.user.id) {
      throw new AppError('Not authorized to delete this classroom', 403);
    }

    classroomService.deleteClassroom(id);
    res.json({ message: 'Classroom deleted' });
  },
};
