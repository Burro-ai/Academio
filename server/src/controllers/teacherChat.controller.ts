import { Request, Response } from 'express';
import { teacherAssistantService } from '../services/teacherAssistant.service';
import { teacherSessionsQueries } from '../database/queries/teacherSessions.queries';
import { teachersQueries } from '../database/queries/teachers.queries';
import { TeacherChatRequest, CreateTeacherChatSessionRequest, MaterialType } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';
import { config } from '../config';

/**
 * Build conversation context for the LLM
 */
const buildPrompt = (
  messages: { role: 'user' | 'assistant'; content: string }[],
  newMessage: string,
  materialType?: MaterialType
): string => {
  let prompt = '';

  // Add material type context
  if (materialType && materialType !== 'general') {
    const typeContext: Record<MaterialType, string> = {
      lesson: 'Context: Creating a lesson plan. Include objectives, activities, and time estimates.\n\n',
      presentation: 'Context: Creating a presentation. Structure with clear sections and key points.\n\n',
      test: 'Context: Creating an assessment. Include various question types and answer key.\n\n',
      homework: 'Context: Creating homework. Include clear instructions and practice problems.\n\n',
      general: '',
    };
    prompt += typeContext[materialType];
  }

  // Include conversation history
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `Teacher: ${msg.content}\n\n`;
    } else {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }

  // Add the new message
  prompt += `Teacher: ${newMessage}\n\nAssistant:`;

  return prompt;
};

export const teacherChatController = {
  /**
   * Stream chat response using SSE
   * GET /api/teacher/chat/stream?sessionId=xxx&message=xxx&materialType=xxx
   */
  async streamChat(req: Request, res: Response) {
    const { sessionId, message, materialType } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      throw new AppError('sessionId is required', 400);
    }

    if (!message || typeof message !== 'string') {
      throw new AppError('message is required', 400);
    }

    // Verify session exists
    const session = teacherSessionsQueries.getById(sessionId);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Save user message
    const userMessage = teacherSessionsQueries.createMessage(sessionId, 'user', message);

    // Get conversation history
    const history = teacherSessionsQueries.getRecentMessages(sessionId, 10);

    // Build prompt with context
    const prompt = buildPrompt(
      history.filter((m) => m.id !== userMessage.id),
      message,
      (materialType as MaterialType) || session.materialType
    );

    // Create placeholder for assistant message
    const assistantMessage = teacherSessionsQueries.createMessage(sessionId, 'assistant', '');

    // Send message IDs to client
    res.write(
      `data: ${JSON.stringify({
        type: 'start',
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      })}\n\n`
    );

    let fullResponse = '';

    try {
      // Stream response
      for await (const chunk of teacherAssistantService.generateStream(prompt)) {
        fullResponse += chunk.text;

        res.write(
          `data: ${JSON.stringify({
            type: 'token',
            content: chunk.text,
          })}\n\n`
        );

        if (chunk.done) {
          break;
        }
      }

      // Save complete response
      teacherSessionsQueries.updateMessageContent(assistantMessage.id, fullResponse);
      teacherSessionsQueries.touch(sessionId);

      // Send completion signal
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMessage.id,
        })}\n\n`
      );
    } catch (error) {
      console.error('Stream error:', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: 'Failed to generate response',
        })}\n\n`
      );
    }

    res.end();
  },

  /**
   * Get all chat sessions for the teacher
   * GET /api/teacher/chat/sessions
   */
  async getSessions(req: Request, res: Response) {
    // Get first teacher (MVP)
    let teachers = teachersQueries.getAll();
    if (teachers.length === 0) {
      // Create default teacher
      teachersQueries.create('Default Teacher', 'teacher@academio.com', config.teacherPassword);
      teachers = teachersQueries.getAll();
    }

    const sessions = teacherSessionsQueries.getByTeacherId(teachers[0].id);
    res.json(sessions);
  },

  /**
   * Get a single session with messages
   * GET /api/teacher/chat/sessions/:id
   */
  async getSession(req: Request, res: Response) {
    const { id } = req.params;

    const session = teacherSessionsQueries.getById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const messages = teacherSessionsQueries.getMessages(id);

    res.json({
      ...session,
      messages,
    });
  },

  /**
   * Create a new chat session
   * POST /api/teacher/chat/sessions
   */
  async createSession(req: Request, res: Response) {
    const { title, materialType } = req.body as CreateTeacherChatSessionRequest;

    // Get first teacher (MVP)
    let teachers = teachersQueries.getAll();
    if (teachers.length === 0) {
      teachersQueries.create('Default Teacher', 'teacher@academio.com', config.teacherPassword);
      teachers = teachersQueries.getAll();
    }

    const session = teacherSessionsQueries.create({
      teacherId: teachers[0].id,
      title,
      materialType,
    });

    res.status(201).json(session);
  },

  /**
   * Update a session
   * PATCH /api/teacher/chat/sessions/:id
   */
  async updateSession(req: Request, res: Response) {
    const { id } = req.params;
    const { title, materialType } = req.body;

    const session = teacherSessionsQueries.update(id, { title, materialType });
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    res.json(session);
  },

  /**
   * Delete a session
   * DELETE /api/teacher/chat/sessions/:id
   */
  async deleteSession(req: Request, res: Response) {
    const { id } = req.params;

    const deleted = teacherSessionsQueries.delete(id);
    if (!deleted) {
      throw new AppError('Session not found', 404);
    }

    res.status(204).send();
  },
};
