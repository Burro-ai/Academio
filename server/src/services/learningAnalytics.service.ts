import { analyticsQueries } from '../database/queries/analytics.queries';
import { LearningAnalytics, StudentActivity, InterventionAlert } from '../types';

/**
 * Weights for struggle score calculation
 */
const STRUGGLE_WEIGHTS = {
  questionsPerMinute: 0.3,  // More questions in less time = more struggle
  repetitiveQuestions: 0.3, // Asking similar things = confusion
  sessionLength: 0.2,       // Very long sessions might indicate struggle
  noResolution: 0.2,        // Not reaching understanding
};

/**
 * Threshold for triggering intervention
 */
const INTERVENTION_THRESHOLD = 0.7;

class LearningAnalyticsService {
  /**
   * Get analytics for a student
   */
  getStudentAnalytics(studentId: string): LearningAnalytics[] {
    return analyticsQueries.getByStudentId(studentId);
  }

  /**
   * Get student activity summary
   */
  getStudentActivity(studentId: string): StudentActivity {
    return analyticsQueries.getStudentActivity(studentId);
  }

  /**
   * Get students needing intervention for a teacher
   */
  getInterventionAlerts(teacherId: string): InterventionAlert[] {
    return analyticsQueries.getStudentsNeedingIntervention(teacherId);
  }

  /**
   * Calculate struggle score based on session behavior
   * Returns a value between 0 (no struggle) and 1 (high struggle)
   */
  calculateStruggleScore(data: {
    questionsAsked: number;
    timeSpentSeconds: number;
    repetitiveQuestions?: number;
    resolved: boolean;
  }): number {
    const { questionsAsked, timeSpentSeconds, repetitiveQuestions = 0, resolved } = data;

    // Questions per minute (normalize to 0-1)
    const minutes = timeSpentSeconds / 60;
    const questionsPerMinute = minutes > 0 ? questionsAsked / minutes : 0;
    // More than 2 questions per minute indicates struggle
    const questionScore = Math.min(questionsPerMinute / 2, 1);

    // Repetitive questions (normalize to 0-1)
    // More than 3 repetitive questions indicates high confusion
    const repetitionScore = Math.min(repetitiveQuestions / 3, 1);

    // Session length (normalize to 0-1)
    // Sessions over 30 minutes might indicate struggle
    const lengthScore = Math.min(minutes / 30, 1);

    // Resolution score
    const resolutionScore = resolved ? 0 : 1;

    // Weighted sum
    const score =
      STRUGGLE_WEIGHTS.questionsPerMinute * questionScore +
      STRUGGLE_WEIGHTS.repetitiveQuestions * repetitionScore +
      STRUGGLE_WEIGHTS.sessionLength * lengthScore +
      STRUGGLE_WEIGHTS.noResolution * resolutionScore;

    return Math.round(score * 100) / 100;
  }

  /**
   * Update analytics when a student asks a question
   */
  recordQuestion(sessionId: string, studentId: string, subject?: string, topic?: string): LearningAnalytics {
    const existing = analyticsQueries.getBySessionId(sessionId);

    if (existing) {
      analyticsQueries.incrementQuestions(sessionId);

      // Recalculate struggle score
      const newScore = this.calculateStruggleScore({
        questionsAsked: existing.questionsAsked + 1,
        timeSpentSeconds: existing.timeSpentSeconds,
        resolved: existing.resolved,
      });
      analyticsQueries.updateStruggleScore(sessionId, newScore);

      return {
        ...existing,
        questionsAsked: existing.questionsAsked + 1,
        struggleScore: newScore,
      };
    } else {
      // Create new analytics record
      return analyticsQueries.upsert({
        userId: studentId,
        sessionId,
        subject,
        topic,
        questionsAsked: 1,
        timeSpentSeconds: 0,
        struggleScore: 0.1, // Initial low score
        resolved: false,
      });
    }
  }

  /**
   * Update time spent in a session
   */
  updateTimeSpent(sessionId: string, timeSpentSeconds: number): void {
    const existing = analyticsQueries.getBySessionId(sessionId);
    if (existing) {
      analyticsQueries.upsert({
        userId: existing.studentId,
        sessionId,
        timeSpentSeconds,
      });

      // Recalculate struggle score
      const newScore = this.calculateStruggleScore({
        questionsAsked: existing.questionsAsked,
        timeSpentSeconds,
        resolved: existing.resolved,
      });
      analyticsQueries.updateStruggleScore(sessionId, newScore);
    }
  }

  /**
   * Mark a session as resolved (student reached understanding)
   */
  markResolved(sessionId: string): void {
    analyticsQueries.markResolved(sessionId);

    // Update struggle score to reflect resolution
    const existing = analyticsQueries.getBySessionId(sessionId);
    if (existing) {
      const newScore = this.calculateStruggleScore({
        questionsAsked: existing.questionsAsked,
        timeSpentSeconds: existing.timeSpentSeconds,
        resolved: true,
      });
      analyticsQueries.updateStruggleScore(sessionId, newScore);
    }
  }

  /**
   * Check if a student needs intervention
   */
  needsIntervention(studentId: string): boolean {
    const activity = analyticsQueries.getStudentActivity(studentId);
    return activity.averageStruggleScore > INTERVENTION_THRESHOLD;
  }

  /**
   * Get intervention recommendation for a student
   */
  getInterventionRecommendation(studentId: string): string | null {
    const activity = analyticsQueries.getStudentActivity(studentId);

    if (!activity.needsIntervention) {
      return null;
    }

    if (activity.averageStruggleScore > 0.9) {
      return 'Immediate one-on-one support recommended. Student appears very confused.';
    }

    if (activity.averageStruggleScore > 0.8) {
      return 'Schedule a check-in with the student. They may need additional explanation.';
    }

    if (activity.totalQuestionsThisWeek > 20) {
      return 'Student is asking many questions. Consider providing supplementary materials.';
    }

    return 'Monitor the student and provide encouragement. They may need more practice time.';
  }
}

export const learningAnalyticsService = new LearningAnalyticsService();
