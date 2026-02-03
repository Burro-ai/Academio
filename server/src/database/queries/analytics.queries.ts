import { getDb } from '../db';
import { LearningAnalytics, StudentActivity, InterventionAlert } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface AnalyticsRow {
  id: string;
  student_id: string;
  session_id: string;
  subject: string | null;
  topic: string | null;
  questions_asked: number;
  time_spent_seconds: number;
  struggle_score: number;
  resolved: number;
  created_at: string;
  updated_at: string;
}

const rowToAnalytics = (row: AnalyticsRow): LearningAnalytics => ({
  id: row.id,
  studentId: row.student_id,
  sessionId: row.session_id,
  subject: row.subject || undefined,
  topic: row.topic || undefined,
  questionsAsked: row.questions_asked,
  timeSpentSeconds: row.time_spent_seconds,
  struggleScore: row.struggle_score,
  resolved: row.resolved === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const analyticsQueries = {
  /**
   * Get all analytics for a student
   */
  getByStudentId(studentId: string): LearningAnalytics[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, student_id, session_id, subject, topic, questions_asked,
                time_spent_seconds, struggle_score, resolved, created_at, updated_at
         FROM learning_analytics
         WHERE student_id = ?
         ORDER BY created_at DESC`
      )
      .all(studentId) as AnalyticsRow[];
    return rows.map(rowToAnalytics);
  },

  /**
   * Get analytics for a specific session
   */
  getBySessionId(sessionId: string): LearningAnalytics | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, student_id, session_id, subject, topic, questions_asked,
                time_spent_seconds, struggle_score, resolved, created_at, updated_at
         FROM learning_analytics
         WHERE session_id = ?`
      )
      .get(sessionId) as AnalyticsRow | undefined;
    return row ? rowToAnalytics(row) : null;
  },

  /**
   * Get student activity summary
   */
  getStudentActivity(studentId: string): StudentActivity {
    const db = getDb();

    // Get recent sessions with analytics
    const recentSessions = db
      .prepare(
        `SELECT la.session_id as id, s.topic, la.questions_asked, la.struggle_score,
                la.created_at as createdAt
         FROM learning_analytics la
         JOIN sessions s ON la.session_id = s.id
         WHERE la.student_id = ?
         ORDER BY la.created_at DESC
         LIMIT 10`
      )
      .all(studentId) as {
        id: string;
        topic: string;
        questions_asked: number;
        struggle_score: number;
        createdAt: string;
      }[];

    // Get questions this week
    const questionsThisWeek = db
      .prepare(
        `SELECT SUM(questions_asked) as total
         FROM learning_analytics
         WHERE student_id = ?
         AND created_at > datetime('now', '-7 days')`
      )
      .get(studentId) as { total: number | null };

    // Get average struggle score (last 7 days)
    const avgStruggle = db
      .prepare(
        `SELECT AVG(struggle_score) as avg
         FROM learning_analytics
         WHERE student_id = ?
         AND created_at > datetime('now', '-7 days')`
      )
      .get(studentId) as { avg: number | null };

    // Get topics studied
    const topics = db
      .prepare(
        `SELECT DISTINCT topic
         FROM learning_analytics
         WHERE student_id = ?
         AND topic IS NOT NULL
         AND created_at > datetime('now', '-30 days')`
      )
      .all(studentId) as { topic: string }[];

    const avgScore = avgStruggle.avg || 0;

    return {
      recentSessions: recentSessions.map(s => ({
        id: s.id,
        topic: s.topic,
        questionsAsked: s.questions_asked,
        struggleScore: s.struggle_score,
        createdAt: s.createdAt,
      })),
      totalQuestionsThisWeek: questionsThisWeek.total || 0,
      averageStruggleScore: Math.round(avgScore * 100) / 100,
      topicsStudied: topics.map(t => t.topic),
      needsIntervention: avgScore > 0.7,
    };
  },

  /**
   * Get students needing intervention (high struggle scores)
   */
  getStudentsNeedingIntervention(teacherId: string): InterventionAlert[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT
           s.id as studentId,
           s.name as studentName,
           la.struggle_score as struggleScore,
           la.subject,
           la.topic,
           la.created_at as createdAt
         FROM learning_analytics la
         JOIN students s ON la.student_id = s.id
         JOIN classrooms c ON s.classroom_id = c.id
         WHERE c.teacher_id = ?
         AND la.struggle_score > 0.7
         AND la.resolved = 0
         AND la.created_at > datetime('now', '-7 days')
         ORDER BY la.struggle_score DESC`
      )
      .all(teacherId) as {
        studentId: string;
        studentName: string;
        struggleScore: number;
        subject: string | null;
        topic: string | null;
        createdAt: string;
      }[];

    return rows.map(row => ({
      studentId: row.studentId,
      studentName: row.studentName,
      reason: row.struggleScore > 0.9
        ? 'Critical: Student appears very confused'
        : 'Student is struggling with the material',
      struggleScore: row.struggleScore,
      subject: row.subject || undefined,
      topic: row.topic || undefined,
      recommendedAction: row.struggleScore > 0.9
        ? 'Consider immediate one-on-one support'
        : 'Review concepts during next class',
      createdAt: row.createdAt,
    }));
  },

  /**
   * Create or update analytics for a session
   */
  upsert(data: {
    studentId: string;
    sessionId: string;
    subject?: string;
    topic?: string;
    questionsAsked?: number;
    timeSpentSeconds?: number;
    struggleScore?: number;
    resolved?: boolean;
  }): LearningAnalytics {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = this.getBySessionId(data.sessionId);

    if (existing) {
      // Update existing
      const newQuestionsAsked = data.questionsAsked ?? existing.questionsAsked;
      const newTimeSpent = data.timeSpentSeconds ?? existing.timeSpentSeconds;
      const newStruggleScore = data.struggleScore ?? existing.struggleScore;
      const newResolved = data.resolved !== undefined ? (data.resolved ? 1 : 0) : (existing.resolved ? 1 : 0);

      db.prepare(
        `UPDATE learning_analytics
         SET questions_asked = ?, time_spent_seconds = ?, struggle_score = ?,
             resolved = ?, updated_at = ?
         WHERE session_id = ?`
      ).run(newQuestionsAsked, newTimeSpent, newStruggleScore, newResolved, now, data.sessionId);

      return {
        ...existing,
        questionsAsked: newQuestionsAsked,
        timeSpentSeconds: newTimeSpent,
        struggleScore: newStruggleScore,
        resolved: newResolved === 1,
        updatedAt: now,
      };
    } else {
      // Create new
      const id = uuidv4();

      db.prepare(
        `INSERT INTO learning_analytics (id, student_id, session_id, subject, topic,
                                         questions_asked, time_spent_seconds, struggle_score,
                                         resolved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        data.studentId,
        data.sessionId,
        data.subject || null,
        data.topic || null,
        data.questionsAsked || 0,
        data.timeSpentSeconds || 0,
        data.struggleScore || 0,
        data.resolved ? 1 : 0,
        now,
        now
      );

      return {
        id,
        studentId: data.studentId,
        sessionId: data.sessionId,
        subject: data.subject,
        topic: data.topic,
        questionsAsked: data.questionsAsked || 0,
        timeSpentSeconds: data.timeSpentSeconds || 0,
        struggleScore: data.struggleScore || 0,
        resolved: data.resolved || false,
        createdAt: now,
        updatedAt: now,
      };
    }
  },

  /**
   * Increment questions asked for a session
   */
  incrementQuestions(sessionId: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE learning_analytics
       SET questions_asked = questions_asked + 1, updated_at = ?
       WHERE session_id = ?`
    ).run(now, sessionId);
  },

  /**
   * Update struggle score for a session
   */
  updateStruggleScore(sessionId: string, score: number): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE learning_analytics
       SET struggle_score = ?, updated_at = ?
       WHERE session_id = ?`
    ).run(score, now, sessionId);
  },

  /**
   * Mark session as resolved
   */
  markResolved(sessionId: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE learning_analytics
       SET resolved = 1, updated_at = ?
       WHERE session_id = ?`
    ).run(now, sessionId);
  },
};
