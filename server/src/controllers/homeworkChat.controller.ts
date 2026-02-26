import { Response } from 'express';
import { homeworkChatService } from '../services/homeworkChat.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { JwtAuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const homeworkChatController = {
  /**
   * GET /api/student/homework-chat/stream
   * Stream homework chat responses using SSE
   */
  async stream(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { homeworkId, message, questionContext } = req.query;

    if (!homeworkId || typeof homeworkId !== 'string') {
      throw new AppError('homeworkId is required', 400);
    }

    if (!message || typeof message !== 'string') {
      throw new AppError('message is required', 400);
    }

    // Verify the student has access to this homework
    const allHomework = homeworkQueries.getPersonalizedByStudentId(req.user.id);
    const homework = allHomework.find(h => h.id === homeworkId);

    if (!homework) {
      throw new AppError('Homework not found or access denied', 404);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const event of homeworkChatService.streamChat(
        homeworkId,
        req.user.id,
        message,
        typeof questionContext === 'string' ? questionContext : undefined
      )) {
        // Send SSE event
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }
    } catch (error) {
      console.error('[HomeworkChat] Stream error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    }

    res.end();
  },

  /**
   * GET /api/student/homework-chat/:homeworkId
   * Get existing chat session and messages for a homework
   */
  async getSession(req: JwtAuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { homeworkId } = req.params;

    // Verify the student has access to this homework
    const allHomework = homeworkQueries.getPersonalizedByStudentId(req.user.id);
    const personalizedHomework = allHomework.find(h => h.id === homeworkId);

    if (!personalizedHomework) {
      throw new AppError('Homework not found or access denied', 404);
    }

    // Get or create the session
    const session = homeworkChatService.getOrCreateSession(homeworkId, req.user.id);

    // Get messages
    const messages = homeworkChatService.getSessionMessages(session.id);

    // Get questions from homework
    const questions = personalizedHomework.questionsJson || personalizedHomework.homework?.questionsJson || [];

    res.json({
      session,
      messages,
      homework: {
        id: personalizedHomework.id,
        title: personalizedHomework.homework.title,
        topic: personalizedHomework.homework.topic,
        subject: personalizedHomework.homework.subject,
        questions,
        content: personalizedHomework.personalizedContent,
      },
    });
  },
};
