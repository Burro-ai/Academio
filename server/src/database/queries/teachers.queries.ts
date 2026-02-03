import { getDb } from '../db';
import { Teacher } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Simple password hashing for MVP (use bcrypt in production)
const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

export const teachersQueries = {
  /**
   * Get all teachers
   */
  getAll(): Teacher[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, email, created_at as createdAt, updated_at as updatedAt
         FROM teachers
         ORDER BY name ASC`
      )
      .all() as Teacher[];
    return rows;
  },

  /**
   * Get a teacher by ID
   */
  getById(id: string): Teacher | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, name, email, created_at as createdAt, updated_at as updatedAt
         FROM teachers
         WHERE id = ?`
      )
      .get(id) as Teacher | undefined;
    return row || null;
  },

  /**
   * Get a teacher by email
   */
  getByEmail(email: string): (Teacher & { passwordHash: string }) | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, name, email, password_hash as passwordHash,
                created_at as createdAt, updated_at as updatedAt
         FROM teachers
         WHERE email = ?`
      )
      .get(email) as (Teacher & { passwordHash: string }) | undefined;
    return row || null;
  },

  /**
   * Create a new teacher
   */
  create(name: string, email: string, password: string): Teacher {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    db.prepare(
      `INSERT INTO teachers (id, name, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, email, passwordHash, now, now);

    return {
      id,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Update a teacher
   */
  update(id: string, data: { name?: string; email?: string }): Teacher | null {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) return null;

    const newName = data.name ?? existing.name;
    const newEmail = data.email ?? existing.email;

    db.prepare(
      `UPDATE teachers
       SET name = ?, email = ?, updated_at = ?
       WHERE id = ?`
    ).run(newName, newEmail, now, id);

    return {
      ...existing,
      name: newName,
      email: newEmail,
      updatedAt: now,
    };
  },

  /**
   * Update teacher password
   */
  updatePassword(id: string, newPassword: string): boolean {
    const db = getDb();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(newPassword);

    const result = db
      .prepare(
        `UPDATE teachers
         SET password_hash = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(passwordHash, now, id);

    return result.changes > 0;
  },

  /**
   * Delete a teacher
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM teachers WHERE id = ?`).run(id);
    return result.changes > 0;
  },

  /**
   * Verify teacher credentials
   */
  verifyCredentials(email: string, password: string): Teacher | null {
    const teacher = this.getByEmail(email);
    if (!teacher) return null;

    if (!verifyPassword(password, teacher.passwordHash)) {
      return null;
    }

    // Return teacher without password hash
    const { passwordHash, ...teacherData } = teacher;
    return teacherData;
  },
};
