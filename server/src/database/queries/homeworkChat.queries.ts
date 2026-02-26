import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database row types
 */
interface HomeworkChatSessionRow {
  id: string;
  personalized_homework_id: string;
  student_id: string;
  created_at: string;
  updated_at: string;
}

interface HomeworkChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  question_context: string | null;
  timestamp: string;
}

interface HomeworkChatSessionWithDetailsRow extends HomeworkChatSessionRow {
  homework_title: string;
  homework_topic: string;
  homework_subject: string | null;
  message_count: number;
}

/**
 * Application types
 */
export interface HomeworkChatSession {
  id: string;
  personalizedHomeworkId: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  questionContext?: string;
  timestamp: string;
}

export interface HomeworkChatSessionWithDetails extends HomeworkChatSession {
  homeworkTitle: string;
  homeworkTopic: string;
  homeworkSubject?: string;
  messageCount: number;
}

/**
 * Convert row to session object
 */
const rowToSession = (row: HomeworkChatSessionRow): HomeworkChatSession => ({
  id: row.id,
  personalizedHomeworkId: row.personalized_homework_id,
  studentId: row.student_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Convert row to message object
 */
const rowToMessage = (row: HomeworkChatMessageRow): HomeworkChatMessage => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  questionContext: row.question_context || undefined,
  timestamp: row.timestamp,
});

export const homeworkChatQueries = {
  /**
   * Create a new homework chat session
   */
  createSession(personalizedHomeworkId: string, studentId: string): HomeworkChatSession {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO homework_chat_sessions (id, personalized_homework_id, student_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, personalizedHomeworkId, studentId, now, now);

    return {
      id,
      personalizedHomeworkId,
      studentId,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Get session by personalized homework ID and student ID
   */
  getSession(personalizedHomeworkId: string, studentId: string): HomeworkChatSession | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT * FROM homework_chat_sessions
        WHERE personalized_homework_id = ? AND student_id = ?
      `)
      .get(personalizedHomeworkId, studentId) as HomeworkChatSessionRow | undefined;

    if (!row) return null;
    return rowToSession(row);
  },

  /**
   * Get or create session (upsert pattern)
   */
  getOrCreateSession(personalizedHomeworkId: string, studentId: string): HomeworkChatSession {
    const existing = this.getSession(personalizedHomeworkId, studentId);
    if (existing) return existing;
    return this.createSession(personalizedHomeworkId, studentId);
  },

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): HomeworkChatSession | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM homework_chat_sessions WHERE id = ?')
      .get(sessionId) as HomeworkChatSessionRow | undefined;

    if (!row) return null;
    return rowToSession(row);
  },

  /**
   * Update session timestamp (touch)
   */
  touchSession(sessionId: string): void {
    const db = getDb();
    db.prepare(`
      UPDATE homework_chat_sessions
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
    content: string,
    questionContext?: string
  ): HomeworkChatMessage {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO homework_chat_messages (id, session_id, role, content, question_context, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, questionContext || null, now);

    // Touch the session
    this.touchSession(sessionId);

    return {
      id,
      sessionId,
      role,
      content,
      questionContext,
      timestamp: now,
    };
  },

  /**
   * Update message content (for streaming completion)
   */
  updateMessageContent(messageId: string, content: string): void {
    const db = getDb();
    db.prepare('UPDATE homework_chat_messages SET content = ? WHERE id = ?').run(
      content,
      messageId
    );
  },

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string, limit?: number): HomeworkChatMessage[] {
    const db = getDb();
    let query = `
      SELECT * FROM homework_chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;

    if (limit) {
      // Get last N messages
      query = `
        SELECT * FROM (
          SELECT * FROM homework_chat_messages
          WHERE session_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        ) ORDER BY timestamp ASC
      `;
      const rows = db.prepare(query).all(sessionId, limit) as HomeworkChatMessageRow[];
      return rows.map(rowToMessage);
    }

    const rows = db.prepare(query).all(sessionId) as HomeworkChatMessageRow[];
    return rows.map(rowToMessage);
  },

  /**
   * Get recent messages for context (same as getMessages with limit)
   */
  getRecentMessages(sessionId: string, limit: number = 10): HomeworkChatMessage[] {
    return this.getMessages(sessionId, limit);
  },

  /**
   * Get all sessions for a student with homework details
   */
  getSessionsByStudent(studentId: string): HomeworkChatSessionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          hcs.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          (SELECT COUNT(*) FROM homework_chat_messages WHERE session_id = hcs.id) as message_count
        FROM homework_chat_sessions hcs
        JOIN personalized_homework ph ON hcs.personalized_homework_id = ph.id
        JOIN homework_assignments h ON ph.homework_id = h.id
        WHERE hcs.student_id = ?
        ORDER BY hcs.updated_at DESC
      `)
      .all(studentId) as HomeworkChatSessionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSession(row),
      homeworkTitle: row.homework_title,
      homeworkTopic: row.homework_topic,
      homeworkSubject: row.homework_subject || undefined,
      messageCount: row.message_count,
    }));
  },

  /**
   * Get all sessions for homework created by a teacher
   */
  getSessionsForTeacher(teacherId: string): HomeworkChatSessionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          hcs.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          (SELECT COUNT(*) FROM homework_chat_messages WHERE session_id = hcs.id) as message_count
        FROM homework_chat_sessions hcs
        JOIN personalized_homework ph ON hcs.personalized_homework_id = ph.id
        JOIN homework_assignments h ON ph.homework_id = h.id
        WHERE h.teacher_id = ?
        ORDER BY hcs.updated_at DESC
      `)
      .all(teacherId) as HomeworkChatSessionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSession(row),
      homeworkTitle: row.homework_title,
      homeworkTopic: row.homework_topic,
      homeworkSubject: row.homework_subject || undefined,
      messageCount: row.message_count,
    }));
  },

  /**
   * Get sessions by student for a specific teacher's homework
   */
  getStudentSessionsForTeacher(
    studentId: string,
    teacherId: string
  ): HomeworkChatSessionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          hcs.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          (SELECT COUNT(*) FROM homework_chat_messages WHERE session_id = hcs.id) as message_count
        FROM homework_chat_sessions hcs
        JOIN personalized_homework ph ON hcs.personalized_homework_id = ph.id
        JOIN homework_assignments h ON ph.homework_id = h.id
        WHERE hcs.student_id = ? AND h.teacher_id = ?
        ORDER BY hcs.updated_at DESC
      `)
      .all(studentId, teacherId) as HomeworkChatSessionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSession(row),
      homeworkTitle: row.homework_title,
      homeworkTopic: row.homework_topic,
      homeworkSubject: row.homework_subject || undefined,
      messageCount: row.message_count,
    }));
  },

  /**
   * Get message count for a session
   */
  getMessageCount(sessionId: string): number {
    const db = getDb();
    const row = db
      .prepare('SELECT COUNT(*) as count FROM homework_chat_messages WHERE session_id = ?')
      .get(sessionId) as { count: number };
    return row.count;
  },

  /**
   * Delete a session and all its messages
   */
  deleteSession(sessionId: string): boolean {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM homework_chat_sessions WHERE id = ?')
      .run(sessionId);
    return result.changes > 0;
  },
};
