import { getDb } from '../db';
import { TeacherChatSession, TeacherChatMessage, MaterialType } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface SessionRow {
  id: string;
  teacher_id: string;
  title: string | null;
  material_type: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
}

const rowToSession = (row: SessionRow): TeacherChatSession => ({
  id: row.id,
  teacherId: row.teacher_id,
  title: row.title || 'Untitled Session',
  materialType: (row.material_type as MaterialType) || 'general',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToMessage = (row: MessageRow): TeacherChatMessage => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role as 'user' | 'assistant',
  content: row.content,
  timestamp: row.timestamp,
});

export const teacherSessionsQueries = {
  /**
   * Get all sessions for a teacher
   */
  getByTeacherId(teacherId: string): TeacherChatSession[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, teacher_id, title, material_type, created_at, updated_at
         FROM teacher_chat_sessions
         WHERE teacher_id = ?
         ORDER BY updated_at DESC`
      )
      .all(teacherId) as SessionRow[];
    return rows.map(rowToSession);
  },

  /**
   * Get a session by ID
   */
  getById(id: string): TeacherChatSession | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, teacher_id, title, material_type, created_at, updated_at
         FROM teacher_chat_sessions
         WHERE id = ?`
      )
      .get(id) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  },

  /**
   * Create a new session
   */
  create(data: {
    teacherId: string;
    title?: string;
    materialType?: MaterialType;
  }): TeacherChatSession {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const title = data.title || 'New Session';
    const materialType = data.materialType || 'general';

    db.prepare(
      `INSERT INTO teacher_chat_sessions (id, teacher_id, title, material_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, data.teacherId, title, materialType, now, now);

    return {
      id,
      teacherId: data.teacherId,
      title,
      materialType,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Update a session
   */
  update(
    id: string,
    data: { title?: string; materialType?: MaterialType }
  ): TeacherChatSession | null {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) return null;

    const newTitle = data.title ?? existing.title;
    const newMaterialType = data.materialType ?? existing.materialType;

    db.prepare(
      `UPDATE teacher_chat_sessions
       SET title = ?, material_type = ?, updated_at = ?
       WHERE id = ?`
    ).run(newTitle, newMaterialType, now, id);

    return {
      ...existing,
      title: newTitle,
      materialType: newMaterialType,
      updatedAt: now,
    };
  },

  /**
   * Touch session (update timestamp)
   */
  touch(id: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`UPDATE teacher_chat_sessions SET updated_at = ? WHERE id = ?`).run(now, id);
  },

  /**
   * Delete a session
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM teacher_chat_sessions WHERE id = ?`).run(id);
    return result.changes > 0;
  },

  // ===== MESSAGE METHODS =====

  /**
   * Get messages for a session
   */
  getMessages(sessionId: string): TeacherChatMessage[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, session_id, role, content, timestamp
         FROM teacher_chat_messages
         WHERE session_id = ?
         ORDER BY timestamp ASC`
      )
      .all(sessionId) as MessageRow[];
    return rows.map(rowToMessage);
  },

  /**
   * Get recent messages for context
   */
  getRecentMessages(sessionId: string, limit: number = 10): TeacherChatMessage[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, session_id, role, content, timestamp
         FROM teacher_chat_messages
         WHERE session_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(sessionId, limit) as MessageRow[];
    return rows.map(rowToMessage).reverse();
  },

  /**
   * Create a message
   */
  createMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): TeacherChatMessage {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO teacher_chat_messages (id, session_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, sessionId, role, content, now);

    return {
      id,
      sessionId,
      role,
      content,
      timestamp: now,
    };
  },

  /**
   * Update message content
   */
  updateMessageContent(id: string, content: string): void {
    const db = getDb();
    db.prepare(`UPDATE teacher_chat_messages SET content = ? WHERE id = ?`).run(content, id);
  },
};
