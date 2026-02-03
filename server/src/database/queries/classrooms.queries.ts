import { getDb } from '../db';
import { Classroom } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface ClassroomRow {
  id: string;
  name: string;
  teacher_id: string;
  subject: string | null;
  grade_level: string | null;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

const rowToClassroom = (row: ClassroomRow): Classroom => ({
  id: row.id,
  name: row.name,
  teacherId: row.teacher_id,
  subject: row.subject || undefined,
  gradeLevel: row.grade_level || undefined,
  studentCount: row.student_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const classroomsQueries = {
  /**
   * Get all classrooms
   */
  getAll(): Classroom[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.teacher_id, c.subject, c.grade_level,
                c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM students WHERE classroom_id = c.id) as student_count
         FROM classrooms c
         ORDER BY c.name ASC`
      )
      .all() as ClassroomRow[];
    return rows.map(rowToClassroom);
  },

  /**
   * Get classrooms by teacher ID
   */
  getByTeacherId(teacherId: string): Classroom[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.teacher_id, c.subject, c.grade_level,
                c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM students WHERE classroom_id = c.id) as student_count
         FROM classrooms c
         WHERE c.teacher_id = ?
         ORDER BY c.name ASC`
      )
      .all(teacherId) as ClassroomRow[];
    return rows.map(rowToClassroom);
  },

  /**
   * Get a classroom by ID
   */
  getById(id: string): Classroom | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT c.id, c.name, c.teacher_id, c.subject, c.grade_level,
                c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM students WHERE classroom_id = c.id) as student_count
         FROM classrooms c
         WHERE c.id = ?`
      )
      .get(id) as ClassroomRow | undefined;
    return row ? rowToClassroom(row) : null;
  },

  /**
   * Create a new classroom
   */
  create(data: {
    name: string;
    teacherId: string;
    subject?: string;
    gradeLevel?: string;
  }): Classroom {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO classrooms (id, name, teacher_id, subject, grade_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.teacherId, data.subject || null, data.gradeLevel || null, now, now);

    return {
      id,
      name: data.name,
      teacherId: data.teacherId,
      subject: data.subject,
      gradeLevel: data.gradeLevel,
      studentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Update a classroom
   */
  update(
    id: string,
    data: {
      name?: string;
      subject?: string;
      gradeLevel?: string;
    }
  ): Classroom | null {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) return null;

    const newName = data.name ?? existing.name;
    const newSubject = data.subject ?? existing.subject;
    const newGradeLevel = data.gradeLevel ?? existing.gradeLevel;

    db.prepare(
      `UPDATE classrooms
       SET name = ?, subject = ?, grade_level = ?, updated_at = ?
       WHERE id = ?`
    ).run(newName, newSubject || null, newGradeLevel || null, now, id);

    return {
      ...existing,
      name: newName,
      subject: newSubject,
      gradeLevel: newGradeLevel,
      updatedAt: now,
    };
  },

  /**
   * Delete a classroom
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM classrooms WHERE id = ?`).run(id);
    return result.changes > 0;
  },
};
