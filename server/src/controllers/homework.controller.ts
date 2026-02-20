import { Response } from 'express';
import { homeworkService, PersonalizationProgress } from '../services/homework.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { JwtAuthenticatedRequest, CreateHomeworkRequest, UpdateHomeworkRequest, HomeworkQuestionJson } from '../types';
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

    const { title, topic, subject, masterContent, dueDate, classroomId, generateForStudents, sourceLessonId } =
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
      sourceLessonId,
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

    const { topic, subject, lessonId } = req.body;

    if (!topic) {
      throw new AppError('Topic is required', 400);
    }

    const content = await homeworkService.generateMasterContent(topic, subject, lessonId);
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

    const { topic, subject, lessonId } = req.query;

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
        typeof subject === 'string' ? subject : undefined,
        typeof lessonId === 'string' ? lessonId : undefined
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

  /**
   * PUT /api/homework/:id/questions
   * Update homework questions (only if not yet assigned)
   */
  async updateQuestions(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;
    const { questions } = req.body as { questions: HomeworkQuestionJson[] };

    if (!questions || !Array.isArray(questions)) {
      throw new AppError('Questions array is required', 400);
    }

    // Verify ownership
    const existing = homeworkQueries.getById(id);
    if (!existing) {
      throw new AppError('Homework not found', 404);
    }
    if (existing.teacherId !== req.user.id) {
      throw new AppError('Not authorized to update this homework', 403);
    }

    // Check if already assigned
    if (homeworkQueries.isAssigned(id)) {
      throw new AppError('Cannot update questions: homework is already assigned to students', 400);
    }

    try {
      const homework = homeworkQueries.updateQuestions(id, questions);
      res.json(homework);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already assigned')) {
        throw new AppError(error.message, 400);
      }
      throw error;
    }
  },

  /**
   * POST /api/homework/:id/assign
   * Assign homework to students (locks questions)
   */
  async assignHomework(req: JwtAuthenticatedRequest, res: Response) {
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
      throw new AppError('Not authorized to assign this homework', 403);
    }

    // Check if already assigned
    if (homeworkQueries.isAssigned(id)) {
      throw new AppError('Homework is already assigned', 400);
    }

    // Verify homework has questions
    if (!existing.questionsJson || existing.questionsJson.length === 0) {
      throw new AppError('Cannot assign homework without questions', 400);
    }

    // Mark as assigned (locks questions)
    const homework = homeworkQueries.markAssigned(id);

    // Personalize for students (run in background)
    homeworkService.personalizeForStudentsInClassroom(id, existing.classroomId).catch((err) => {
      console.error('[Homework] Background personalization failed:', err);
    });

    res.json({
      homework,
      message: 'Homework assigned. Personalization is running in the background.',
    });
  },

  /**
   * GET /api/homework/:id/status
   * Get homework status including whether it's assigned
   */
  async getStatus(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    const homework = homeworkQueries.getWithTeacher(id);
    if (!homework) {
      throw new AppError('Homework not found', 404);
    }

    res.json({
      id: homework.id,
      isAssigned: !!homework.assignedAt,
      assignedAt: homework.assignedAt,
      personalizedCount: homework.personalizedCount,
      questionsCount: homework.questionsJson?.length || 0,
    });
  },
};
