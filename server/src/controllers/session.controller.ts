import { Request, Response } from 'express';
import { sessionsQueries } from '../database/queries/sessions.queries';
import { messagesQueries } from '../database/queries/messages.queries';
import { CreateSessionRequest, UpdateSessionRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const sessionController = {
  /**
   * Get all sessions
   */
  async getAll(req: Request, res: Response) {
    const sessions = sessionsQueries.getAll();
    res.json(sessions);
  },

  /**
   * Get a single session with messages
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const session = sessionsQueries.getById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const messages = messagesQueries.getBySessionId(id);

    res.json({
      ...session,
      messages,
    });
  },

  /**
   * Create a new session
   */
  async create(req: Request, res: Response) {
    const { topic, title } = req.body as CreateSessionRequest;

    if (!topic) {
      throw new AppError('topic is required', 400);
    }

    const validTopics = ['math', 'science', 'history', 'writing', 'general'];
    if (!validTopics.includes(topic)) {
      throw new AppError(`Invalid topic. Must be one of: ${validTopics.join(', ')}`, 400);
    }

    const session = sessionsQueries.create(topic, title);
    res.status(201).json(session);
  },

  /**
   * Update a session
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { title, topic } = req.body as UpdateSessionRequest;

    const session = sessionsQueries.update(id, { title, topic });
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    res.json(session);
  },

  /**
   * Delete a session
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const deleted = sessionsQueries.delete(id);
    if (!deleted) {
      throw new AppError('Session not found', 404);
    }

    res.status(204).send();
  },
};
