import { Response } from 'express';
import { homeworkService, PersonalizationProgress } from '../services/homework.service';
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

    const { title, topic, subject, masterContent, dueDate, classroomId, generateForStudents } =
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
      classroomId,
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

  /**
   * GET /api/homework/generate-content/stream
   * Stream master content generation using SSE
   */
  async streamGenerateContent(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { topic, subject } = req.query;

    if (!topic || typeof topic !== 'string') {
      throw new AppError('Topic is required', 400);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of homeworkService.generateMasterContentStream(
        topic,
        typeof subject === 'string' ? subject : undefined
      )) {
        res.write(`data: ${JSON.stringify({ text: chunk.text, done: chunk.done })}\n\n`);

        if (chunk.done) {
          break;
        }
      }
    } catch (error) {
      console.error('[Homework] Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Generation failed', done: true })}\n\n`);
    }

    res.end();
  },

  /**
   * GET /api/homework/:id/progress
   * Get personalization progress for homework
   */
  async getProgress(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify the homework exists
    const homework = homeworkQueries.getById(id);
    if (!homework) {
      throw new AppError('Homework not found', 404);
    }

    // Get progress
    const progress = homeworkService.getProgress(id);

    if (!progress) {
      res.json({
        homeworkId: id,
        status: 'idle',
        total: 0,
        completed: 0,
        current: null,
      });
      return;
    }

    res.json(progress);
  },
};
