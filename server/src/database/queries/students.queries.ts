import { getDb } from '../db';
import { Student, StudentWithDetails } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  grade_level: string | null;
  classroom_id: string | null;
  created_at: string;
  updated_at: string;
}

const rowToStudent = (row: StudentRow): Student => ({
  id: row.id,
  name: row.name,
  email: row.email || undefined,
  avatarUrl: row.avatar_url || undefined,
  gradeLevel: row.grade_level || undefined,
  classroomId: row.classroom_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const studentsQueries = {
  /**
   * Get all students
   */
  getAll(): Student[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, email, avatar_url, grade_level, classroom_id,
                created_at, updated_at
         FROM students
         ORDER BY name ASC`
      )
      .all() as StudentRow[];
    return rows.map(rowToStudent);
  },

  /**
   * Get students by classroom ID
   */
  getByClassroomId(classroomId: string): Student[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, email, avatar_url, grade_level, classroom_id,
                created_at, updated_at
         FROM students
         WHERE classroom_id = ?
         ORDER BY name ASC`
      )
      .all(classroomId) as StudentRow[];
    return rows.map(rowToStudent);
  },

  /**
   * Get students by teacher ID (through classrooms)
   */
  getByTeacherId(teacherId: string): Student[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT s.id, s.name, s.email, s.avatar_url, s.grade_level,
                s.classroom_id, s.created_at, s.updated_at
         FROM students s
         JOIN classrooms c ON s.classroom_id = c.id
         WHERE c.teacher_id = ?
         ORDER BY s.name ASC`
      )
      .all(teacherId) as StudentRow[];
    return rows.map(rowToStudent);
  },

  /**
   * Get a student by ID
   */
  getById(id: string): Student | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, name, email, avatar_url, grade_level, classroom_id,
                created_at, updated_at
         FROM students
         WHERE id = ?`
      )
      .get(id) as StudentRow | undefined;
    return row ? rowToStudent(row) : null;
  },

  /**
   * Get a student with details (classroom info, struggle score)
   */
  getByIdWithDetails(id: string): StudentWithDetails | null {
    const db = getDb();

    const row = db
      .prepare(
        `SELECT s.id, s.name, s.email, s.avatar_url, s.grade_level,
                s.classroom_id, s.created_at, s.updated_at,
                c.id as classroom_id_ref, c.name as classroom_name,
                (SELECT AVG(struggle_score) FROM learning_analytics
                 WHERE student_id = s.id
                 AND created_at > datetime('now', '-7 days')) as avg_struggle
         FROM students s
         LEFT JOIN classrooms c ON s.classroom_id = c.id
         WHERE s.id = ?`
      )
      .get(id) as (StudentRow & {
        classroom_id_ref: string | null;
        classroom_name: string | null;
        avg_struggle: number | null;
      }) | undefined;

    if (!row) return null;

    const student = rowToStudent(row);

    // Get total sessions
    const sessionsResult = db
      .prepare(`SELECT COUNT(*) as count FROM sessions WHERE student_id = ?`)
      .get(id) as { count: number };

    return {
      ...student,
      classroom: row.classroom_id_ref ? {
        id: row.classroom_id_ref,
        name: row.classroom_name || '',
      } : undefined,
      currentStruggleScore: row.avg_struggle || 0,
      totalSessions: sessionsResult.count,
    };
  },

  /**
   * Create a new student
   */
  create(data: {
    name: string;
    email?: string;
    gradeLevel?: string;
    classroomId?: string;
  }): Student {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO students (id, name, email, grade_level, classroom_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.email || null, data.gradeLevel || null, data.classroomId || null, now, now);

    return {
      id,
      name: data.name,
      email: data.email,
      gradeLevel: data.gradeLevel,
      classroomId: data.classroomId,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Update a student
   */
  update(
    id: string,
    data: {
      name?: string;
      email?: string;
      avatarUrl?: string;
      gradeLevel?: string;
      classroomId?: string;
    }
  ): Student | null {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) return null;

    const newName = data.name ?? existing.name;
    const newEmail = data.email ?? existing.email;
    const newAvatarUrl = data.avatarUrl ?? existing.avatarUrl;
    const newGradeLevel = data.gradeLevel ?? existing.gradeLevel;
    const newClassroomId = data.classroomId ?? existing.classroomId;

    db.prepare(
      `UPDATE students
       SET name = ?, email = ?, avatar_url = ?, grade_level = ?,
           classroom_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(newName, newEmail || null, newAvatarUrl || null, newGradeLevel || null, newClassroomId || null, now, id);

    return {
      ...existing,
      name: newName,
      email: newEmail,
      avatarUrl: newAvatarUrl,
      gradeLevel: newGradeLevel,
      classroomId: newClassroomId,
      updatedAt: now,
    };
  },

  /**
   * Delete a student
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM students WHERE id = ?`).run(id);
    return result.changes > 0;
  },
};
