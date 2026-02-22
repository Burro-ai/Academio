import { Response } from 'express';
import { JwtAuthenticatedRequest } from '../types';
import { exitTicketService } from '../services/exitTicket.service';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { analyticsQueries } from '../database/queries/analytics.queries';
import { lessonChatQueries } from '../database/queries/lessonChat.queries';

/**
 * Exit Ticket Controller
 *
 * Handles comprehension verification before a student marks a lesson as complete.
 */
export const exitTicketController = {
  /**
   * POST /api/student/lessons/:lessonId/exit-ticket
   * Generate 2-3 comprehension questions for the given personalized lesson.
   */
  async generate(req: JwtAuthenticatedRequest, res: Response): Promise<void> {
    const studentId = req.user?.id;
    if (!studentId) {
      res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    const { lessonId } = req.params;

    // Fetch the personalized lesson (lessonId here is the personalized_lesson id)
    const personalizedLesson = lessonsQueries.getPersonalizedById(lessonId);
    if (!personalizedLesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    // Verify ownership
    if (personalizedLesson.studentId !== studentId) {
      res.status(403).json({ error: 'Access denied', code: 'INSUFFICIENT_PERMISSIONS' });
      return;
    }

    // Get the master lesson for topic metadata
    const masterLesson = lessonsQueries.getById(personalizedLesson.lessonId);
    if (!masterLesson) {
      res.status(404).json({ error: 'Master lesson not found' });
      return;
    }

    // Get student profile for age-appropriate question generation
    const studentProfile = studentProfilesQueries.getByUserId(studentId);

    try {
      const content = personalizedLesson.personalizedContent || masterLesson.masterContent;
      const questions = await exitTicketService.generateQuestions(
        content,
        masterLesson.topic,
        studentProfile?.age ?? null,
        studentProfile?.gradeLevel ?? null
      );

      res.json({ questions });
    } catch (error) {
      console.error('[ExitTicket] Generate error:', error);
      res.status(500).json({ error: 'Failed to generate exit ticket questions' });
    }
  },

  /**
   * POST /api/student/lessons/:lessonId/exit-ticket/submit
   * Evaluate student answers and (if passed) mark the lesson as viewed/complete.
   *
   * Body: { questions: ExitTicketQuestion[], answers: string[] }
   */
  async submit(req: JwtAuthenticatedRequest, res: Response): Promise<void> {
    const studentId = req.user?.id;
    if (!studentId) {
      res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    const { lessonId } = req.params;
    const { questions, answers } = req.body as {
      questions?: Array<{ id: number; question: string }>;
      answers?: string[];
    };

    if (!questions || !answers || !Array.isArray(questions) || !Array.isArray(answers)) {
      res.status(400).json({ error: 'questions and answers arrays are required' });
      return;
    }

    // Fetch the personalized lesson
    const personalizedLesson = lessonsQueries.getPersonalizedById(lessonId);
    if (!personalizedLesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    if (personalizedLesson.studentId !== studentId) {
      res.status(403).json({ error: 'Access denied', code: 'INSUFFICIENT_PERMISSIONS' });
      return;
    }

    // Get the master lesson for content
    const masterLesson = lessonsQueries.getById(personalizedLesson.lessonId);
    if (!masterLesson) {
      res.status(404).json({ error: 'Master lesson not found' });
      return;
    }

    // Resolve the analytics session_id for this student/lesson pair
    const chatSession = lessonChatQueries.getSession(lessonId, studentId);
    const sessionId = chatSession?.id ?? '';

    // Get student profile
    const studentProfile = studentProfilesQueries.getByUserId(studentId);

    try {
      const content = personalizedLesson.personalizedContent || masterLesson.masterContent;

      const result = await exitTicketService.evaluateAnswers(
        questions,
        answers,
        content,
        sessionId,
        studentProfile?.age ?? null,
        studentProfile?.gradeLevel ?? null
      );

      // If passed, mark lesson as viewed/complete
      if (result.passed) {
        lessonsQueries.markAsViewed(lessonId);
      }

      res.json(result);
    } catch (error) {
      console.error('[ExitTicket] Submit error:', error);
      res.status(500).json({ error: 'Failed to evaluate exit ticket' });
    }
  },
};
