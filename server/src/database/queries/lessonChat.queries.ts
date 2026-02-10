import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database row types
 */
interface LessonChatSessionRow {
  id: string;
  personalized_lesson_id: string;
  student_id: string;
  created_at: string;
  updated_at: string;
}

interface LessonChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface LessonChatSessionWithDetailsRow extends LessonChatSessionRow {
  lesson_title: string;
  lesson_topic: string;
  lesson_subject: string | null;
  message_count: number;
}

/**
 * Application types
 */
export interface LessonChatSession {
  id: string;
  personalizedLessonId: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface LessonChatSessionWithDetails extends LessonChatSession {
  lessonTitle: string;
  lessonTopic: string;
  lessonSubject?: string;
  messageCount: number;
}

/**
 * Convert row to session object
 */
const rowToSession = (row: LessonChatSessionRow): LessonChatSession => ({
  id: row.id,
  personalizedLessonId: row.personalized_lesson_id,
  studentId: row.student_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Convert row to message object
 */
const rowToMessage = (row: LessonChatMessageRow): LessonChatMessage => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  timestamp: row.timestamp,
});

export const lessonChatQueries = {
  /**
   * Create a new lesson chat session
   */
  createSession(personalizedLessonId: string, studentId: string): LessonChatSession {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO lesson_chat_sessions (id, personalized_lesson_id, student_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, personalizedLessonId, studentId, now, now);

    return {
      id,
      personalizedLessonId,
      studentId,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Get session by personalized lesson ID and student ID
   */
  getSession(personalizedLessonId: string, studentId: string): LessonChatSession | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT * FROM lesson_chat_sessions
        WHERE personalized_lesson_id = ? AND student_id = ?
      `)
      .get(personalizedLessonId, studentId) as LessonChatSessionRow | undefined;

    if (!row) return null;
    return rowToSession(row);
  },

  /**
   * Get or create session (upsert pattern)
   */
  getOrCreateSession(personalizedLessonId: string, studentId: string): LessonChatSession {
    const existing = this.getSession(personalizedLessonId, studentId);
    if (existing) return existing;
    return this.createSession(personalizedLessonId, studentId);
  },

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): LessonChatSession | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM lesson_chat_sessions WHERE id = ?')
      .get(sessionId) as LessonChatSessionRow | undefined;

    if (!row) return null;
    return rowToSession(row);
  },

  /**
   * Update session timestamp (touch)
   */
  touchSession(sessionId: string): void {
    const db = getDb();
    db.prepare(`
      UPDATE lesson_chat_sessions
      SET updated_at = datetime('now')
      WHERE id = ?
    `).run(sessionId);
  },

  /**
   * Create a new chat message
   */
  createMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): LessonChatMessage {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO lesson_chat_messages (id, session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, now);

    // Touch the session
    this.touchSession(sessionId);

    return {
      id,
      sessionId,
      role,
      content,
      timestamp: now,
    };
  },

  /**
   * Update message content (for streaming completion)
   */
  updateMessageContent(messageId: string, content: string): void {
    const db = getDb();
    db.prepare('UPDATE lesson_chat_messages SET content = ? WHERE id = ?').run(
      content,
      messageId
    );
  },

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string, limit?: number): LessonChatMessage[] {
    const db = getDb();
    let query = `
      SELECT * FROM lesson_chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;

    if (limit) {
      // Get last N messages
      query = `
        SELECT * FROM (
          SELECT * FROM lesson_chat_messages
          WHERE session_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        ) ORDER BY timestamp ASC
      `;
      const rows = db.prepare(query).all(sessionId, limit) as LessonChatMessageRow[];
      return rows.map(rowToMessage);
    }

    const rows = db.prepare(query).all(sessionId) as LessonChatMessageRow[];
    return rows.map(rowToMessage);
  },

  /**
   * Get recent messages for context (same as getMessages with limit)
   */
  getRecentMessages(sessionId: string, limit: number = 10): LessonChatMessage[] {
    return this.getMessages(sessionId, limit);
  },

  /**
   * Get all sessions for a student with lesson details
   */
  getSessionsByStudent(studentId: string): LessonChatSessionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          lcs.*,
          l.title as lesson_title,
          l.topic as lesson_topic,
          l.subject as lesson_subject,
          (SELECT COUNT(*) FROM lesson_chat_messages WHERE session_id = lcs.id) as message_count
        FROM lesson_chat_sessions lcs
        JOIN personalized_lessons pl ON lcs.personalized_lesson_id = pl.id
        JOIN lessons l ON pl.lesson_id = l.id
        WHERE lcs.student_id = ?
        ORDER BY lcs.updated_at DESC
      `)
      .all(studentId) as LessonChatSessionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSession(row),
      lessonTitle: row.lesson_title,
      lessonTopic: row.lesson_topic,
      lessonSubject: row.lesson_subject || undefined,
      messageCount: row.message_count,
    }));
  },

  /**
   * Get all sessions for lessons created by a teacher
   */
  getSessionsForTeacher(teacherId: string): LessonChatSessionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          lcs.*,
          l.title as lesson_title,
          l.topic as lesson_topic,
          l.subject as lesson_subject,
          (SELECT COUNT(*) FROM lesson_chat_messages WHERE session_id = lcs.id) as message_count
        FROM lesson_chat_sessions lcs
        JOIN personalized_lessons pl ON lcs.personalized_lesson_id = pl.id
        JOIN lessons l ON pl.lesson_id = l.id
        WHERE l.teacher_id = ?
        ORDER BY lcs.updated_at DESC
      `)
      .all(teacherId) as LessonChatSessionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSession(row),
      lessonTitle: row.lesson_title,
      lessonTopic: row.lesson_topic,
      lessonSubject: row.lesson_subject || undefined,
      messageCount: row.message_count,
    }));
  },

  /**
   * Get sessions by student for a specific teacher's lessons
   */
  getStudentSessionsForTeacher(
    studentId: string,
    teacherId: string
  ): LessonChatSessionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          lcs.*,
          l.title as lesson_title,
          l.topic as lesson_topic,
          l.subject as lesson_subject,
          (SELECT COUNT(*) FROM lesson_chat_messages WHERE session_id = lcs.id) as message_count
        FROM lesson_chat_sessions lcs
        JOIN personalized_lessons pl ON lcs.personalized_lesson_id = pl.id
        JOIN lessons l ON pl.lesson_id = l.id
        WHERE lcs.student_id = ? AND l.teacher_id = ?
        ORDER BY lcs.updated_at DESC
      `)
      .all(studentId, teacherId) as LessonChatSessionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSession(row),
      lessonTitle: row.lesson_title,
      lessonTopic: row.lesson_topic,
      lessonSubject: row.lesson_subject || undefined,
      messageCount: row.message_count,
    }));
  },

  /**
   * Get message count for a session
   */
  getMessageCount(sessionId: string): number {
    const db = getDb();
    const row = db
      .prepare('SELECT COUNT(*) as count FROM lesson_chat_messages WHERE session_id = ?')
      .get(sessionId) as { count: number };
    return row.count;
  },

  /**
   * Delete a session and all its messages
   */
  deleteSession(sessionId: string): boolean {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM lesson_chat_sessions WHERE id = ?')
      .run(sessionId);
    return result.changes > 0;
  },
};
