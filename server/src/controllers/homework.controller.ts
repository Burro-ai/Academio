import { Response } from 'express';
import { homeworkService } from '../services/homework.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { JwtAuthenticatedRequest, CreateHomeworkRequest, UpdateHomeworkRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const homeworkController = {
  /**
   * GET /api/homework
   * Get all homework for current teacher
   */
  async getHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const homework = homeworkQueries.getByTeacherId(req.user.id);
    res.json(homework);
  },

  /**
   * GET /api/homework/:id
   * Get homework by ID
   */
  async getHomeworkById(req: JwtAuthenticatedRequest, res: Response) {
    const { id } = req.params;

    const homework = homeworkQueries.getWithTeacher(id);
    if (!homework) {
      throw new AppError('Homework not found', 404);
    }

    res.json(homework);
  },

  /**
   * POST /api/homework
   * Create a new homework assignment
   */
  async createHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { title, topic, subject, masterContent, dueDate, generateForStudents } =
      req.body as CreateHomeworkRequest;

    if (!title || !topic) {
      throw new AppError('Title and topic are required', 400);
    }

    const homework = await homeworkService.createHomework(req.user.id, {
      title,
      topic,
      subject,
      masterContent,
      dueDate,
      generateForStudents,
    });

    res.status(201).json(homework);
  },

  /**
   * PUT /api/homework/:id
   * Update homework
   */
  async updateHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;
    const { title, topic, subject, masterContent, dueDate } = req.body as UpdateHomeworkRequest;

    // Verify ownership
    const existing = homeworkQueries.getById(id);
    if (!existing) {
      throw new AppError('Homework not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to update this homework', 403);
    }

    const homework = homeworkQueries.update(id, { title, topic, subject, masterContent, dueDate });
    res.json(homework);
  },

  /**
   * DELETE /api/homework/:id
   * Delete homework
   */
  async deleteHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify ownership
    const existing = homeworkQueries.getById(id);
    if (!existing) {
      throw new AppError('Homework not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to delete this homework', 403);
    }

    homeworkQueries.delete(id);
    res.json({ message: 'Homework deleted' });
  },

  /**
   * POST /api/homework/:id/personalize
   * Personalize homework for all students
   */
  async personalizeHomework(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify ownership
    const existing = homeworkQueries.getById(id);
    if (!existing) {
      throw new AppError('Homework not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to personalize this homework', 403);
    }

    const count = await homeworkService.personalizeForAllStudents(id);
    res.json({ message: `Personalized for ${count} students`, count });
  },

  /**
   * POST /api/homework/generate-content
   * Generate master content using AI
   */
  async generateContent(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { topic, subject } = req.body;

    if (!topic) {
      throw new AppError('Topic is required', 400);
    }

    const content = await homeworkService.generateMasterContent(topic, subject);
    res.json({ content });
  },
};
