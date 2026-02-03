import { Request, Response } from 'express';
import { studentService } from '../services/student.service';
import { gradesService } from '../services/grades.service';
import { learningAnalyticsService } from '../services/learningAnalytics.service';
import { teachersQueries } from '../database/queries/teachers.queries';
import { CreateStudentRequest, UpdateStudentRequest, AddGradeRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const studentController = {
  /**
   * Get all students for the teacher
   * GET /api/students
   */
  async getAll(req: Request, res: Response) {
    const { classroomId } = req.query;

    if (classroomId && typeof classroomId === 'string') {
      const students = studentService.getStudentsByClassroom(classroomId);
      res.json(students);
      return;
    }

    // Get students for first teacher (MVP)
    const teachers = teachersQueries.getAll();
    if (teachers.length === 0) {
      res.json([]);
      return;
    }

    const students = studentService.getStudentsByTeacher(teachers[0].id);
    res.json(students);
  },

  /**
   * Get a student's full profile
   * GET /api/students/:id
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const profile = studentService.getStudentProfile(id);
    if (!profile) {
      throw new AppError('Student not found', 404);
    }

    res.json(profile);
  },

  /**
   * Get a student's grades
   * GET /api/students/:id/grades
   */
  async getGrades(req: Request, res: Response) {
    const { id } = req.params;
    const { subject } = req.query;

    if (subject && typeof subject === 'string') {
      const grades = gradesService.getGradesForSubject(id, subject as any);
      res.json(grades);
      return;
    }

    const gradesBySubject = gradesService.getGradesBySubject(id);
    res.json(gradesBySubject);
  },

  /**
   * Add a grade for a student
   * POST /api/students/:id/grades
   */
  async addGrade(req: Request, res: Response) {
    const { id } = req.params;
    const { subject, grade, maxGrade, assignmentName, assignmentType } = req.body as Omit<AddGradeRequest, 'studentId'>;

    if (!subject || grade === undefined) {
      throw new AppError('Subject and grade are required', 400);
    }

    const newGrade = gradesService.addGrade({
      studentId: id,
      subject,
      grade,
      maxGrade,
      assignmentName,
      assignmentType,
    });

    res.status(201).json(newGrade);
  },

  /**
   * Get a student's learning activity
   * GET /api/students/:id/activity
   */
  async getActivity(req: Request, res: Response) {
    const { id } = req.params;

    const activity = studentService.getStudentActivity(id);
    res.json(activity);
  },

  /**
   * Get intervention recommendation for a student
   * GET /api/students/:id/intervention
   */
  async getIntervention(req: Request, res: Response) {
    const { id } = req.params;

    const needsIntervention = learningAnalyticsService.needsIntervention(id);
    const recommendation = learningAnalyticsService.getInterventionRecommendation(id);

    res.json({
      needsIntervention,
      recommendation,
    });
  },

  /**
   * Create a new student
   * POST /api/students
   */
  async create(req: Request, res: Response) {
    const { name, email, gradeLevel, classroomId } = req.body as CreateStudentRequest;

    if (!name) {
      throw new AppError('Student name is required', 400);
    }

    const student = studentService.createStudent({
      name,
      email,
      gradeLevel,
      classroomId,
    });

    res.status(201).json(student);
  },

  /**
   * Update a student
   * PATCH /api/students/:id
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { name, email, avatarUrl, gradeLevel, classroomId } = req.body as UpdateStudentRequest;

    const student = studentService.updateStudent(id, {
      name,
      email,
      avatarUrl,
      gradeLevel,
      classroomId,
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    res.json(student);
  },

  /**
   * Delete a student
   * DELETE /api/students/:id
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const deleted = studentService.deleteStudent(id);
    if (!deleted) {
      throw new AppError('Student not found', 404);
    }

    res.status(204).send();
  },
};
