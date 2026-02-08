import { getDb } from '../db';
import { Session, Topic } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface SessionRow {
  id: string;
  topic: string;
  title: string;
  student_id: string | null;
  user_id: string | null;
  school_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionWithUser extends Session {
  userId?: string;
  schoolId?: string;
}

export const sessionsQueries = {
  /**
   * Get all sessions ordered by most recently updated
   */
  getAll(): Session[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, topic, title, created_at as createdAt, updated_at as updatedAt
         FROM sessions
         ORDER BY updated_at DESC`
      )
      .all() as Session[];
    return rows;
  },

  /**
   * Get all sessions for a school
   */
  getAllBySchoolId(schoolId: string): Session[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, topic, title, created_at as createdAt, updated_at as updatedAt
         FROM sessions
         WHERE school_id = ?
         ORDER BY updated_at DESC`
      )
      .all(schoolId) as Session[];
    return rows;
  },

  /**
   * Get a single session by ID
   */
  getById(id: string): SessionWithUser | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, topic, title, student_id, user_id, school_id, created_at, updated_at
         FROM sessions
         WHERE id = ?`
      )
      .get(id) as SessionRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      topic: row.topic as Topic,
      title: row.title,
      userId: row.user_id || row.student_id || undefined,
      schoolId: row.school_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * Get sessions by user ID (uses user_id column, falls back to student_id)
   */
  getByUserId(userId: string): Session[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, topic, title, created_at as createdAt, updated_at as updatedAt
         FROM sessions
         WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)
         ORDER BY updated_at DESC`
      )
      .all(userId, userId) as Session[];
    return rows;
  },

  /**
   * Create a new session
   */
  create(topic: Topic, title?: string, userId?: string, schoolId?: string): SessionWithUser {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const sessionTitle = title || `${topic.charAt(0).toUpperCase() + topic.slice(1)} Session`;

    db.prepare(
      `INSERT INTO sessions (id, topic, title, student_id, user_id, school_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, topic, sessionTitle, userId || null, userId || null, schoolId || null, now, now);

    return {
      id,
      topic,
      title: sessionTitle,
      userId,
      schoolId,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Update a session
   */
  update(id: string, data: { title?: string; topic?: Topic }): Session | null {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) return null;

    const newTitle = data.title ?? existing.title;
    const newTopic = data.topic ?? existing.topic;

    db.prepare(
      `UPDATE sessions
       SET title = ?, topic = ?, updated_at = ?
       WHERE id = ?`
    ).run(newTitle, newTopic, now, id);

    return {
      ...existing,
      title: newTitle,
      topic: newTopic,
      updatedAt: now,
    };
  },

  /**
   * Update the updated_at timestamp (called when new messages are added)
   */
  touch(id: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(now, id);
  },

  /**
   * Delete a session (messages cascade delete)
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    return result.changes > 0;
  },
};
