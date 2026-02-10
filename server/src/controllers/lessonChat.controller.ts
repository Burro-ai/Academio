import { Response } from 'express';
import { lessonChatService } from '../services/lessonChat.service';
import { lessonChatQueries } from '../database/queries/lessonChat.queries';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { JwtAuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const lessonChatController = {
  /**
   * GET /api/student/lesson-chat/stream
   * Stream chat response for a lesson (SSE)
   */
  async stream(req: JwtAuthenticatedRequest, res: Response) {
    const { lessonId, message } = req.query;
    const studentId = req.user?.id;

    if (!studentId) {
      throw new AppError('Not authenticated', 401);
    }

    if (!lessonId || typeof lessonId !== 'string') {
      throw new AppError('lessonId is required', 400);
    }

    if (!message || typeof message !== 'string') {
      throw new AppError('message is required', 400);
    }

    // Verify this lesson belongs to the student
    const lessons = lessonsQueries.getPersonalizedByStudentId(studentId);
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Stream the chat response
      for await (const event of lessonChatService.streamChat(lessonId, studentId, message)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      console.error('[LessonChat] Stream error:', error);
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
   * GET /api/student/lesson-chat/:lessonId
   * Get lesson chat session and messages
   */
  async getSession(req: JwtAuthenticatedRequest, res: Response) {
    const { lessonId } = req.params;
    const studentId = req.user?.id;

    if (!studentId) {
      throw new AppError('Not authenticated', 401);
    }

    // Verify this lesson belongs to the student
    const lessons = lessonsQueries.getPersonalizedByStudentId(studentId);
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    // Get or create session
    const session = lessonChatService.getOrCreateSession(lessonId, studentId);

    // Get messages
    const messages = lessonChatService.getSessionMessages(session.id);

    res.json({
      session,
      messages,
      lesson: {
        id: lesson.id,
        title: lesson.lesson.title,
        topic: lesson.lesson.topic,
        subject: lesson.lesson.subject,
        content: lesson.personalizedContent,
      },
    });
  },

  /**
   * GET /api/teacher/students/:studentId/lesson-chats
   * Get all lesson chat sessions for a specific student (teacher oversight)
   */
  async getStudentLessonChats(req: JwtAuthenticatedRequest, res: Response) {
    const { studentId } = req.params;
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    // Get sessions for this student that belong to lessons by this teacher
    const sessions = lessonChatService.getStudentSessionsForTeacher(studentId, teacherId);

    res.json(sessions);
  },

  /**
   * GET /api/teacher/lesson-chats/:sessionId
   * View a specific lesson chat session (teacher oversight)
   */
  async viewLessonChat(req: JwtAuthenticatedRequest, res: Response) {
    const { sessionId } = req.params;
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    // Get the session
    const session = lessonChatQueries.getSessionById(sessionId);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Verify this session is for a lesson by this teacher
    const allSessions = lessonChatService.getTeacherSessions(teacherId);
    const isTeachersSession = allSessions.some((s) => s.id === sessionId);

    if (!isTeachersSession) {
      throw new AppError('Access denied', 403);
    }

    // Get messages
    const messages = lessonChatService.getSessionMessages(sessionId);

    // Get lesson details
    const lessons = lessonsQueries.getPersonalizedByStudentId(session.studentId);
    const lesson = lessons.find((l) => l.id === session.personalizedLessonId);

    res.json({
      session,
      messages,
      lesson: lesson
        ? {
            id: lesson.id,
            title: lesson.lesson.title,
            topic: lesson.lesson.topic,
            subject: lesson.lesson.subject,
          }
        : null,
    });
  },
};
