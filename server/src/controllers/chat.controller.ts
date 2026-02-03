import { Request, Response } from 'express';
import { ollamaService } from '../services/ollama.service';
import { messagesQueries } from '../database/queries/messages.queries';
import { sessionsQueries } from '../database/queries/sessions.queries';
import { ChatRequest, Message } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

/**
 * Build conversation context for the LLM
 */
const buildPrompt = (messages: Message[], newMessage: string): string => {
  let prompt = '';

  // Include recent conversation history
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `Student: ${msg.content}\n\n`;
    } else {
      prompt += `Tutor: ${msg.content}\n\n`;
    }
  }

  // Add the new message
  prompt += `Student: ${newMessage}\n\nTutor:`;

  return prompt;
};

export const chatController = {
  /**
   * Stream chat response using SSE
   * GET /api/chat/stream?sessionId=xxx&message=xxx
   */
  async streamChat(req: Request, res: Response) {
    const { sessionId, message } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      throw new AppError('sessionId is required', 400);
    }

    if (!message || typeof message !== 'string') {
      throw new AppError('message is required', 400);
    }

    // Verify session exists
    const session = sessionsQueries.getById(sessionId);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Save user message
    const userMessage = messagesQueries.create(sessionId, 'user', message);

    // Get conversation history
    const history = messagesQueries.getRecentMessages(sessionId, 10);

    // Build prompt with context
    const prompt = buildPrompt(
      history.filter((m) => m.id !== userMessage.id),
      message
    );

    // Create placeholder for assistant message
    const assistantMessage = messagesQueries.create(sessionId, 'assistant', '');

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
      // Stream response from Ollama
      for await (const chunk of ollamaService.generateStream(prompt)) {
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
      messagesQueries.updateContent(assistantMessage.id, fullResponse);
      sessionsQueries.touch(sessionId);

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
   * POST endpoint for chat (non-streaming, for simpler clients)
   */
  async sendMessage(req: Request, res: Response) {
    const { sessionId, message, attachments } = req.body as ChatRequest;

    if (!sessionId) {
      throw new AppError('sessionId is required', 400);
    }

    if (!message) {
      throw new AppError('message is required', 400);
    }

    // Verify session exists
    const session = sessionsQueries.getById(sessionId);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Save user message
    const userMessage = messagesQueries.create(
      sessionId,
      'user',
      message,
      attachments
    );

    // Get conversation history
    const history = messagesQueries.getRecentMessages(sessionId, 10);

    // Build prompt with context
    const prompt = buildPrompt(
      history.filter((m) => m.id !== userMessage.id),
      message
    );

    // Generate response
    const response = await ollamaService.generate(prompt);

    // Save assistant message
    const assistantMessage = messagesQueries.create(
      sessionId,
      'assistant',
      response
    );

    // Update session timestamp
    sessionsQueries.touch(sessionId);

    res.json({
      userMessage,
      assistantMessage,
    });
  },

  /**
   * Health check for Ollama connection
   */
  async healthCheck(req: Request, res: Response) {
    const result = await ollamaService.healthCheck();
    res.json(result);
  },
};
