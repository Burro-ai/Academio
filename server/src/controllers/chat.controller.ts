import { Request, Response } from 'express';
import { ollamaService } from '../services/ollama.service';
import { promptService } from '../services/prompt.service';
import { messagesQueries } from '../database/queries/messages.queries';
import { sessionsQueries } from '../database/queries/sessions.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { ChatRequest, Message, JwtAuthenticatedRequest } from '../types';
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

/**
 * Build enriched system prompt with student profile context
 */
const buildEnrichedSystemPrompt = async (studentId?: string): Promise<string> => {
  // Get base system prompt
  let systemPrompt = await promptService.getPrompt();

  // If we have a student ID, try to get their profile for personalization
  if (studentId) {
    try {
      const profile = studentProfilesQueries.getByUserId(studentId);
      if (profile) {
        systemPrompt += '\n\n## Student Context (Personalization)\n';

        if (profile.age) {
          systemPrompt += `- Student Age: ${profile.age} years old\n`;
        }

        if (profile.gradeLevel) {
          systemPrompt += `- Grade Level: ${profile.gradeLevel}\n`;
        }

        if (profile.favoriteSports && profile.favoriteSports.length > 0) {
          systemPrompt += `- Interests/Activities: ${profile.favoriteSports.join(', ')}\n`;
          systemPrompt += `  (Use these to create relatable examples and analogies)\n`;
        }

        if (profile.skillsToImprove && profile.skillsToImprove.length > 0) {
          systemPrompt += `- Skills to Improve: ${profile.skillsToImprove.join(', ')}\n`;
          systemPrompt += `  (Pay extra attention to helping with these areas)\n`;
        }

        if (profile.learningSystemPrompt) {
          systemPrompt += `\n## Student's Personal Learning Preferences\n`;
          systemPrompt += profile.learningSystemPrompt;
          systemPrompt += '\n';
        }
      }
    } catch (error) {
      console.error('Error fetching student profile for personalization:', error);
      // Continue without personalization if profile fetch fails
    }
  }

  return systemPrompt;
};

export const chatController = {
  /**
   * Stream chat response using SSE
   * GET /api/chat/stream?sessionId=xxx&message=xxx&studentId=xxx (optional)
   */
  async streamChat(req: Request, res: Response) {
    const { sessionId, message, studentId } = req.query;

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

    // Build enriched system prompt with student profile (if studentId provided or in session)
    const studentIdStr = typeof studentId === 'string' ? studentId : session.userId;
    const systemPrompt = await buildEnrichedSystemPrompt(studentIdStr);

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
      // Stream response from Ollama with personalized system prompt
      for await (const chunk of ollamaService.generateStream(prompt, undefined, systemPrompt)) {
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
