import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole, UserRow } from '../../types';

/**
 * Convert database row to User object
 */
const rowToUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  role: row.role,
  name: row.name,
  avatarUrl: row.avatar_url || undefined,
  schoolId: row.school_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const usersQueries = {
  /**
   * Find user by email
   */
  findByEmail(email: string): (User & { passwordHash: string }) | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;

    if (!row) return null;

    return {
      ...rowToUser(row),
      passwordHash: row.password_hash,
    };
  },

  /**
   * Find user by ID
   */
  findById(id: string): User | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;

    if (!row) return null;
    return rowToUser(row);
  },

  /**
   * Create a new user
   */
  create(data: {
    email: string;
    passwordHash: string;
    role: UserRole;
    name: string;
    avatarUrl?: string;
    schoolId?: string;
  }): User {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, avatar_url, school_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, data.email, data.passwordHash, data.role, data.name, data.avatarUrl || null, data.schoolId || null);

    return this.findById(id)!;
  },

  /**
   * Update user
   */
  update(
    id: string,
    data: Partial<{
      name: string;
      avatarUrl: string;
    }>
  ): User | null {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(data.avatarUrl);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  },

  /**
   * Update password
   */
  updatePassword(id: string, passwordHash: string): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(passwordHash, id);
    return result.changes > 0;
  },

  /**
   * Delete user
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Get all users by role
   */
  findByRole(role: UserRole): User[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM users WHERE role = ? ORDER BY name')
      .all(role) as UserRow[];

    return rows.map(rowToUser);
  },

  /**
   * Get all students
   */
  findAllStudents(): User[] {
    return this.findByRole('STUDENT');
  },

  /**
   * Get all teachers
   */
  findAllTeachers(): User[] {
    return this.findByRole('TEACHER');
  },

  /**
   * Check if email exists
   */
  emailExists(email: string): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM users WHERE email = ?')
      .get(email);
    return !!row;
  },

  /**
   * Check if email exists in a specific school
   */
  emailExistsInSchool(email: string, schoolId: string): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM users WHERE email = ? AND school_id = ?')
      .get(email, schoolId);
    return !!row;
  },

  /**
   * Get users by school ID
   */
  findBySchoolId(schoolId: string): User[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM users WHERE school_id = ? ORDER BY name')
      .all(schoolId) as UserRow[];
    return rows.map(rowToUser);
  },

  /**
   * Get users by school ID and role
   */
  findBySchoolIdAndRole(schoolId: string, role: UserRole): User[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM users WHERE school_id = ? AND role = ? ORDER BY name')
      .all(schoolId, role) as UserRow[];
    return rows.map(rowToUser);
  },

  /**
   * Get students by school ID
   */
  findStudentsBySchoolId(schoolId: string): User[] {
    return this.findBySchoolIdAndRole(schoolId, 'STUDENT');
  },

  /**
   * Get teachers by school ID
   */
  findTeachersBySchoolId(schoolId: string): User[] {
    return this.findBySchoolIdAndRole(schoolId, 'TEACHER');
  },

  /**
   * Update user's school
   */
  updateSchool(id: string, schoolId: string | null): User | null {
    const db = getDb();
    db.prepare("UPDATE users SET school_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(schoolId, id);
    return this.findById(id);
  },

  /**
   * Find user by email in a specific school
   */
  findByEmailInSchool(email: string, schoolId: string): (User & { passwordHash: string }) | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM users WHERE email = ? AND school_id = ?')
      .get(email, schoolId) as UserRow | undefined;

    if (!row) return null;

    return {
      ...rowToUser(row),
      passwordHash: row.password_hash,
    };
  },
};
