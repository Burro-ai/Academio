import { getDb } from '../db';
import { Session, Topic } from '../../types';
import { v4 as uuidv4 } from 'uuid';

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
   * Get a single session by ID
   */
  getById(id: string): Session | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, topic, title, created_at as createdAt, updated_at as updatedAt
         FROM sessions
         WHERE id = ?`
      )
      .get(id) as Session | undefined;
    return row || null;
  },

  /**
   * Create a new session
   */
  create(topic: Topic, title?: string): Session {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const sessionTitle = title || `${topic.charAt(0).toUpperCase() + topic.slice(1)} Session`;

    db.prepare(
      `INSERT INTO sessions (id, topic, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, topic, sessionTitle, now, now);

    return {
      id,
      topic,
      title: sessionTitle,
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
