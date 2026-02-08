import { Response } from 'express';
import { sessionsQueries } from '../database/queries/sessions.queries';
import { messagesQueries } from '../database/queries/messages.queries';
import { CreateSessionRequest, UpdateSessionRequest, JwtAuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const sessionController = {
  /**
   * Get all sessions for the authenticated user
   */
  async getAll(req: JwtAuthenticatedRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // Get sessions for this specific user
    const sessions = sessionsQueries.getByUserId(userId);
    res.json(sessions);
  },

  /**
   * Get a single session with messages
   */
  async getById(req: JwtAuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    const session = sessionsQueries.getById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // If user is authenticated, verify they own this session
    if (userId && session.userId && session.userId !== userId) {
      throw new AppError('Access denied to this session', 403);
    }

    const messages = messagesQueries.getBySessionId(id);

    res.json({
      ...session,
      messages,
    });
  },

  /**
   * Create a new session linked to the authenticated user
   */
  async create(req: JwtAuthenticatedRequest, res: Response) {
    const { topic, title } = req.body as CreateSessionRequest;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    if (!topic) {
      throw new AppError('topic is required', 400);
    }

    const validTopics = ['math', 'science', 'history', 'writing', 'general'];
    if (!validTopics.includes(topic)) {
      throw new AppError(`Invalid topic. Must be one of: ${validTopics.join(', ')}`, 400);
    }

    // Create session linked to the authenticated user
    const session = sessionsQueries.create(topic, title, userId, schoolId);
    res.status(201).json(session);
  },

  /**
   * Update a session (only if owned by authenticated user)
   */
  async update(req: JwtAuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { title, topic } = req.body as UpdateSessionRequest;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // Verify ownership
    const existing = sessionsQueries.getById(id);
    if (!existing) {
      throw new AppError('Session not found', 404);
    }

    if (existing.userId && existing.userId !== userId) {
      throw new AppError('Access denied to this session', 403);
    }

    const session = sessionsQueries.update(id, { title, topic });
    res.json(session);
  },

  /**
   * Delete a session (only if owned by authenticated user)
   */
  async delete(req: JwtAuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // Verify ownership
    const existing = sessionsQueries.getById(id);
    if (!existing) {
      throw new AppError('Session not found', 404);
    }

    if (existing.userId && existing.userId !== userId) {
      throw new AppError('Access denied to this session', 403);
    }

    sessionsQueries.delete(id);
    res.status(204).send();
  },
};
