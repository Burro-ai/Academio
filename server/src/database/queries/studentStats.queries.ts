import { getDb } from '../db';

/**
 * Student Stats Query Types
 */

export interface StudentChatStats {
  totalSessions: number;
  totalMessages: number;
  lastChatDate: string | null;
}

export interface StudentHomeworkStats {
  homeworkAssigned: number;
  homeworkSubmitted: number;
  homeworkPending: number;
  homeworkGraded: number;
  averageGrade: number | null;
}

export interface RecentLessonChat {
  id: string;
  lessonTitle: string;
  lessonTopic: string;
  subject: string | null;
  messageCount: number;
  lastActivity: string;
}

export interface RecentHomework {
  id: string;
  title: string;
  topic: string;
  subject: string | null;
  status: 'pending' | 'submitted' | 'graded';
  grade: number | null;
  submittedAt: string | null;
  dueDate: string | null;
}

export interface ActivitySummary {
  studentId: string;
  lastActivity: string | null;
  pendingHomework: number;
  totalChatMessages: number;
}

export interface StudentStats {
  // Chat Activity
  chatHistoryCount: number;
  lessonChatsCompleted: number;
  lastChatDate: string | null;

  // Homework Status
  homeworkAssigned: number;
  homeworkSubmitted: number;
  homeworkPending: number;
  homeworkGraded: number;
  averageGrade: number | null;

  // Session List
  recentSessions: RecentLessonChat[];

  // Homework Details
  recentHomework: RecentHomework[];
}

export const studentStatsQueries = {
  /**
   * Get chat statistics for a student
   * Counts lesson chat sessions and messages
   */
  getChatStats(studentId: string): StudentChatStats {
    const db = getDb();

    const result = db.prepare(`
      SELECT
        COUNT(DISTINCT lcs.id) as total_sessions,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM lesson_chat_messages lcm WHERE lcm.session_id = lcs.id)
        ), 0) as total_messages,
        MAX(lcs.updated_at) as last_chat_date
      FROM lesson_chat_sessions lcs
      WHERE lcs.student_id = ?
    `).get(studentId) as {
      total_sessions: number;
      total_messages: number;
      last_chat_date: string | null;
    };

    return {
      totalSessions: result.total_sessions || 0,
      totalMessages: result.total_messages || 0,
      lastChatDate: result.last_chat_date,
    };
  },

  /**
   * Get homework statistics for a student
   * Counts assigned, submitted, pending, graded homework
   */
  getHomeworkStats(studentId: string): StudentHomeworkStats {
    const db = getDb();

    // Get total assigned homework for this student (personalized homework entries)
    const assignedResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM personalized_homework
      WHERE student_id = ?
    `).get(studentId) as { count: number };

    // Get submission stats
    const submissionResult = db.prepare(`
      SELECT
        COUNT(*) as total_submitted,
        SUM(CASE WHEN graded_at IS NOT NULL THEN 1 ELSE 0 END) as total_graded,
        AVG(CASE WHEN grade IS NOT NULL THEN grade ELSE NULL END) as avg_grade
      FROM homework_submissions
      WHERE student_id = ?
    `).get(studentId) as {
      total_submitted: number;
      total_graded: number;
      avg_grade: number | null;
    };

    const assigned = assignedResult.count;
    const submitted = submissionResult.total_submitted || 0;
    const graded = submissionResult.total_graded || 0;
    const pending = assigned - submitted;

    return {
      homeworkAssigned: assigned,
      homeworkSubmitted: submitted,
      homeworkPending: pending > 0 ? pending : 0,
      homeworkGraded: graded,
      averageGrade: submissionResult.avg_grade,
    };
  },

  /**
   * Get recent lesson chat sessions with details
   * Returns last 10 chat sessions for a student
   */
  getRecentLessonChats(studentId: string, limit: number = 10): RecentLessonChat[] {
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        lcs.id,
        l.title as lesson_title,
        l.topic as lesson_topic,
        l.subject,
        (SELECT COUNT(*) FROM lesson_chat_messages WHERE session_id = lcs.id) as message_count,
        lcs.updated_at as last_activity
      FROM lesson_chat_sessions lcs
      JOIN personalized_lessons pl ON lcs.personalized_lesson_id = pl.id
      JOIN lessons l ON pl.lesson_id = l.id
      WHERE lcs.student_id = ?
      ORDER BY lcs.updated_at DESC
      LIMIT ?
    `).all(studentId, limit) as Array<{
      id: string;
      lesson_title: string;
      lesson_topic: string;
      subject: string | null;
      message_count: number;
      last_activity: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      lessonTitle: row.lesson_title,
      lessonTopic: row.lesson_topic,
      subject: row.subject,
      messageCount: row.message_count,
      lastActivity: row.last_activity,
    }));
  },

  /**
   * Get recent homework with status
   * Returns last 10 homework items for a student
   */
  getRecentHomework(studentId: string, limit: number = 10): RecentHomework[] {
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        ph.id,
        h.title,
        h.topic,
        h.subject,
        h.due_date,
        hs.submitted_at,
        hs.grade,
        hs.graded_at
      FROM personalized_homework ph
      JOIN homework_assignments h ON ph.homework_id = h.id
      LEFT JOIN homework_submissions hs ON hs.personalized_homework_id = ph.id AND hs.student_id = ph.student_id
      WHERE ph.student_id = ?
      ORDER BY h.created_at DESC
      LIMIT ?
    `).all(studentId, limit) as Array<{
      id: string;
      title: string;
      topic: string;
      subject: string | null;
      due_date: string | null;
      submitted_at: string | null;
      grade: number | null;
      graded_at: string | null;
    }>;

    return rows.map(row => {
      let status: 'pending' | 'submitted' | 'graded' = 'pending';
      if (row.graded_at) {
        status = 'graded';
      } else if (row.submitted_at) {
        status = 'submitted';
      }

      return {
        id: row.id,
        title: row.title,
        topic: row.topic,
        subject: row.subject,
        status,
        grade: row.grade,
        submittedAt: row.submitted_at,
        dueDate: row.due_date,
      };
    });
  },

  /**
   * Get activity summary for multiple students in a single batch query
   * Used for the Activity Pulse feature in the student grid
   */
  getActivitySummaryBatch(studentIds: string[]): ActivitySummary[] {
    if (studentIds.length === 0) return [];

    const db = getDb();
    const placeholders = studentIds.map(() => '?').join(',');

    const rows = db.prepare(`
      SELECT
        s.student_id,
        MAX(s.last_activity) as last_activity,
        COALESCE(p.pending_homework, 0) as pending_homework,
        COALESCE(c.total_messages, 0) as total_messages
      FROM (
        -- Get all student IDs with their last activity
        SELECT
          u.id as student_id,
          MAX(COALESCE(lcs.updated_at, hs.submitted_at)) as last_activity
        FROM users u
        LEFT JOIN lesson_chat_sessions lcs ON lcs.student_id = u.id
        LEFT JOIN homework_submissions hs ON hs.student_id = u.id
        WHERE u.id IN (${placeholders})
        GROUP BY u.id
      ) s
      LEFT JOIN (
        -- Count pending homework (assigned but not submitted)
        SELECT
          ph.student_id,
          COUNT(*) - COUNT(hs.id) as pending_homework
        FROM personalized_homework ph
        LEFT JOIN homework_submissions hs ON hs.personalized_homework_id = ph.id AND hs.student_id = ph.student_id
        WHERE ph.student_id IN (${placeholders})
        GROUP BY ph.student_id
      ) p ON p.student_id = s.student_id
      LEFT JOIN (
        -- Count total chat messages
        SELECT
          lcs.student_id,
          COUNT(lcm.id) as total_messages
        FROM lesson_chat_sessions lcs
        JOIN lesson_chat_messages lcm ON lcm.session_id = lcs.id
        WHERE lcs.student_id IN (${placeholders})
        GROUP BY lcs.student_id
      ) c ON c.student_id = s.student_id
    `).all(...studentIds, ...studentIds, ...studentIds) as Array<{
      student_id: string;
      last_activity: string | null;
      pending_homework: number;
      total_messages: number;
    }>;

    // Create a map for quick lookup
    const resultMap = new Map<string, ActivitySummary>();
    rows.forEach(row => {
      resultMap.set(row.student_id, {
        studentId: row.student_id,
        lastActivity: row.last_activity,
        pendingHomework: row.pending_homework,
        totalChatMessages: row.total_messages,
      });
    });

    // Ensure all requested students are included (with defaults if no data)
    return studentIds.map(id => resultMap.get(id) || {
      studentId: id,
      lastActivity: null,
      pendingHomework: 0,
      totalChatMessages: 0,
    });
  },

  /**
   * Get complete student stats (aggregates all above queries)
   */
  getStudentStats(studentId: string): StudentStats {
    const chatStats = this.getChatStats(studentId);
    const homeworkStats = this.getHomeworkStats(studentId);
    const recentSessions = this.getRecentLessonChats(studentId);
    const recentHomework = this.getRecentHomework(studentId);

    return {
      // Chat Activity
      chatHistoryCount: chatStats.totalMessages,
      lessonChatsCompleted: chatStats.totalSessions,
      lastChatDate: chatStats.lastChatDate,

      // Homework Status
      homeworkAssigned: homeworkStats.homeworkAssigned,
      homeworkSubmitted: homeworkStats.homeworkSubmitted,
      homeworkPending: homeworkStats.homeworkPending,
      homeworkGraded: homeworkStats.homeworkGraded,
      averageGrade: homeworkStats.averageGrade,

      // Session List
      recentSessions,

      // Homework Details
      recentHomework,
    };
  },
};
