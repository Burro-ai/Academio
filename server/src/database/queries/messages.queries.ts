import { getDb } from '../db';
import { Message, Attachment } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface MessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments: string | null;
}

const rowToMessage = (row: MessageRow): Message => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  timestamp: row.timestamp,
  attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
});

export const messagesQueries = {
  /**
   * Get all messages for a session
   */
  getBySessionId(sessionId: string): Message[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, session_id, role, content, timestamp, attachments
         FROM messages
         WHERE session_id = ?
         ORDER BY timestamp ASC`
      )
      .all(sessionId) as MessageRow[];
    return rows.map(rowToMessage);
  },

  /**
   * Create a new message
   */
  create(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    attachments?: Attachment[]
  ): Message {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const attachmentsJson = attachments ? JSON.stringify(attachments) : null;

    db.prepare(
      `INSERT INTO messages (id, session_id, role, content, timestamp, attachments)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, sessionId, role, content, now, attachmentsJson);

    return {
      id,
      sessionId,
      role,
      content,
      timestamp: now,
      attachments,
    };
  },

  /**
   * Update message content (used for streaming completion)
   */
  updateContent(id: string, content: string): void {
    const db = getDb();
    db.prepare(`UPDATE messages SET content = ? WHERE id = ?`).run(content, id);
  },

  /**
   * Get the last N messages for context window
   */
  getRecentMessages(sessionId: string, limit: number = 10): Message[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, session_id, role, content, timestamp, attachments
         FROM messages
         WHERE session_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(sessionId, limit) as MessageRow[];
    return rows.map(rowToMessage).reverse();
  },

  /**
   * Delete a message
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
    return result.changes > 0;
  },

  /**
   * Get message count for a session
   */
  countBySessionId(sessionId: string): number {
    const db = getDb();
    const row = db
      .prepare(`SELECT COUNT(*) as count FROM messages WHERE session_id = ?`)
      .get(sessionId) as { count: number };
    return row.count;
  },
};
