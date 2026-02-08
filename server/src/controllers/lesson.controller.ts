import { Response } from 'express';
import { lessonService, PersonalizationProgress } from '../services/lesson.service';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { JwtAuthenticatedRequest, CreateLessonRequest, UpdateLessonRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const lessonController = {
  /**
   * GET /api/lessons
   * Get all lessons for current teacher
   */
  async getLessons(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const lessons = lessonsQueries.getByTeacherId(req.user.id);
    res.json(lessons);
  },

  /**
   * GET /api/lessons/:id
   * Get lesson by ID
   */
  async getLesson(req: JwtAuthenticatedRequest, res: Response) {
    const { id } = req.params;

    const lesson = lessonsQueries.getWithTeacher(id);
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    res.json(lesson);
  },

  /**
   * POST /api/lessons
   * Create a new lesson
   */
  async createLesson(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { title, topic, subject, masterContent, generateForStudents } =
      req.body as CreateLessonRequest;

    if (!title || !topic) {
      throw new AppError('Title and topic are required', 400);
    }

    const lesson = await lessonService.createLesson(req.user.id, {
      title,
      topic,
      subject,
      masterContent,
      generateForStudents,
    });

    res.status(201).json(lesson);
  },

  /**
   * PUT /api/lessons/:id
   * Update a lesson
   */
  async updateLesson(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;
    const { title, topic, subject, masterContent } = req.body as UpdateLessonRequest;

    // Verify ownership
    const existing = lessonsQueries.getById(id);
    if (!existing) {
      throw new AppError('Lesson not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to update this lesson', 403);
    }

    const lesson = lessonsQueries.update(id, { title, topic, subject, masterContent });
    res.json(lesson);
  },

  /**
   * DELETE /api/lessons/:id
   * Delete a lesson
   */
  async deleteLesson(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify ownership
    const existing = lessonsQueries.getById(id);
    if (!existing) {
      throw new AppError('Lesson not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to delete this lesson', 403);
    }

    lessonsQueries.delete(id);
    res.json({ message: 'Lesson deleted' });
  },

  /**
   * POST /api/lessons/:id/personalize
   * Personalize lesson for all students
   */
  async personalizeLesson(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify ownership
    const existing = lessonsQueries.getById(id);
    if (!existing) {
      throw new AppError('Lesson not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to personalize this lesson', 403);
    }

    const count = await lessonService.personalizeForAllStudents(id);
    res.json({ message: `Personalized for ${count} students`, count });
  },

  /**
   * POST /api/lessons/generate-content
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

    const content = await lessonService.generateMasterContent(topic, subject);
    res.json({ content });
  },

  /**
   * GET /api/lessons/generate-content/stream
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
      for await (const chunk of lessonService.generateMasterContentStream(
        topic,
        typeof subject === 'string' ? subject : undefined
      )) {
        res.write(`data: ${JSON.stringify({ text: chunk.text, done: chunk.done })}\n\n`);

        if (chunk.done) {
          break;
        }
      }
    } catch (error) {
      console.error('[Lesson] Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Generation failed', done: true })}\n\n`);
    }

    res.end();
  },

  /**
   * GET /api/lessons/:id/progress
   * Get personalization progress for a lesson
   */
  async getProgress(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Verify the lesson exists
    const lesson = lessonsQueries.getById(id);
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    // Get progress
    const progress = lessonService.getProgress(id);

    if (!progress) {
      res.json({
        lessonId: id,
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
