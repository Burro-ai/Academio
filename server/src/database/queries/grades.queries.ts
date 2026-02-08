import { getDb } from '../db';
import { StudentGrade, Subject, AssignmentType, GradesBySubject } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface GradeRow {
  id: string;
  student_id: string;
  user_id: string | null;
  subject: string;
  grade: number;
  max_grade: number;
  assignment_name: string | null;
  assignment_type: string | null;
  graded_at: string;
}

const rowToGrade = (row: GradeRow): StudentGrade => ({
  id: row.id,
  studentId: row.user_id || row.student_id, // Prefer user_id, fall back to student_id
  subject: row.subject as Subject,
  grade: row.grade,
  maxGrade: row.max_grade,
  assignmentName: row.assignment_name || undefined,
  assignmentType: row.assignment_type as AssignmentType | undefined,
  gradedAt: row.graded_at,
});

export const gradesQueries = {
  /**
   * Get all grades for a user (uses user_id, falls back to student_id)
   */
  getByUserId(userId: string): StudentGrade[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, student_id, user_id, subject, grade, max_grade, assignment_name,
                assignment_type, graded_at
         FROM student_grades
         WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)
         ORDER BY graded_at DESC`
      )
      .all(userId, userId) as GradeRow[];
    return rows.map(rowToGrade);
  },

  /**
   * Get all grades for a student (legacy - calls getByUserId)
   */
  getByStudentId(studentId: string): StudentGrade[] {
    return this.getByUserId(studentId);
  },

  /**
   * Get grades for a user by subject (uses user_id, falls back to student_id)
   */
  getByUserAndSubject(userId: string, subject: Subject): StudentGrade[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, student_id, user_id, subject, grade, max_grade, assignment_name,
                assignment_type, graded_at
         FROM student_grades
         WHERE (user_id = ? OR (user_id IS NULL AND student_id = ?)) AND subject = ?
         ORDER BY graded_at DESC`
      )
      .all(userId, userId, subject) as GradeRow[];
    return rows.map(rowToGrade);
  },

  /**
   * Get grades for a student by subject (legacy - calls getByUserAndSubject)
   */
  getByStudentAndSubject(studentId: string, subject: Subject): StudentGrade[] {
    return this.getByUserAndSubject(studentId, subject);
  },

  /**
   * Get grades grouped by subject with averages and trends (uses user_id)
   */
  getByUserGroupedBySubject(userId: string): GradesBySubject[] {
    const db = getDb();

    // Get all subjects for this user
    const subjects = db
      .prepare(
        `SELECT DISTINCT subject FROM student_grades WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)`
      )
      .all(userId, userId) as { subject: string }[];

    return subjects.map(({ subject }) => {
      const grades = this.getByUserAndSubject(userId, subject as Subject);
      const average = grades.length > 0
        ? grades.reduce((sum, g) => sum + (g.grade / g.maxGrade) * 100, 0) / grades.length
        : 0;

      // Calculate trend (compare last 3 to previous 3)
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (grades.length >= 4) {
        const recent = grades.slice(0, 3).reduce((sum, g) => sum + g.grade / g.maxGrade, 0) / 3;
        const older = grades.slice(3, 6).reduce((sum, g) => sum + g.grade / g.maxGrade, 0) / Math.min(3, grades.length - 3);

        if (recent > older * 1.05) trend = 'improving';
        else if (recent < older * 0.95) trend = 'declining';
      }

      return {
        subject: subject as Subject,
        grades,
        average: Math.round(average * 10) / 10,
        trend,
      };
    });
  },

  /**
   * Get grades grouped by subject (legacy - calls getByUserGroupedBySubject)
   */
  getByStudentGroupedBySubject(studentId: string): GradesBySubject[] {
    return this.getByUserGroupedBySubject(studentId);
  },

  /**
   * Get all subjects for a user
   */
  getSubjectsByUserId(userId: string): string[] {
    const db = getDb();

    // Get all subjects for this user
    const subjects = db
      .prepare(
        `SELECT DISTINCT subject FROM student_grades WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)`
      )
      .all(userId, userId) as { subject: string }[];

    return subjects.map(s => s.subject);
  },

  /**
   * Get recent grades for a user (last N)
   */
  getRecentByUserId(userId: string, limit: number = 10): StudentGrade[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, student_id, user_id, subject, grade, max_grade, assignment_name,
                assignment_type, graded_at
         FROM student_grades
         WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)
         ORDER BY graded_at DESC
         LIMIT ?`
      )
      .all(userId, userId, limit) as GradeRow[];
    return rows.map(rowToGrade);
  },

  /**
   * Get recent grades for a student (legacy - calls getRecentByUserId)
   */
  getRecentByStudentId(studentId: string, limit: number = 10): StudentGrade[] {
    return this.getRecentByUserId(studentId, limit);
  },

  /**
   * Get a grade by ID
   */
  getById(id: string): StudentGrade | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, student_id, user_id, subject, grade, max_grade, assignment_name,
                assignment_type, graded_at
         FROM student_grades
         WHERE id = ?`
      )
      .get(id) as GradeRow | undefined;
    return row ? rowToGrade(row) : null;
  },

  /**
   * Create a new grade (uses user_id)
   */
  create(data: {
    userId: string;
    subject: Subject;
    grade: number;
    maxGrade?: number;
    assignmentName?: string;
    assignmentType?: AssignmentType;
  }): StudentGrade {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const maxGrade = data.maxGrade || 100;

    db.prepare(
      `INSERT INTO student_grades (id, student_id, user_id, subject, grade, max_grade,
                                   assignment_name, assignment_type, graded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.userId, // Also set student_id for backward compatibility
      data.userId,
      data.subject,
      data.grade,
      maxGrade,
      data.assignmentName || null,
      data.assignmentType || null,
      now
    );

    return {
      id,
      studentId: data.userId,
      subject: data.subject,
      grade: data.grade,
      maxGrade,
      assignmentName: data.assignmentName,
      assignmentType: data.assignmentType,
      gradedAt: now,
    };
  },

  /**
   * Update a grade
   */
  update(
    id: string,
    data: {
      grade?: number;
      maxGrade?: number;
      assignmentName?: string;
      assignmentType?: AssignmentType;
    }
  ): StudentGrade | null {
    const db = getDb();

    const existing = this.getById(id);
    if (!existing) return null;

    const newGrade = data.grade ?? existing.grade;
    const newMaxGrade = data.maxGrade ?? existing.maxGrade;
    const newAssignmentName = data.assignmentName ?? existing.assignmentName;
    const newAssignmentType = data.assignmentType ?? existing.assignmentType;

    db.prepare(
      `UPDATE student_grades
       SET grade = ?, max_grade = ?, assignment_name = ?, assignment_type = ?
       WHERE id = ?`
    ).run(newGrade, newMaxGrade, newAssignmentName || null, newAssignmentType || null, id);

    return {
      ...existing,
      grade: newGrade,
      maxGrade: newMaxGrade,
      assignmentName: newAssignmentName,
      assignmentType: newAssignmentType,
    };
  },

  /**
   * Delete a grade
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM student_grades WHERE id = ?`).run(id);
    return result.changes > 0;
  },

  /**
   * Get class average for a subject (uses user_id via student_profiles)
   */
  getClassAverageBySubject(classroomId: string, subject: Subject): number {
    const db = getDb();
    const result = db
      .prepare(
        `SELECT AVG(g.grade / g.max_grade * 100) as average
         FROM student_grades g
         JOIN student_profiles sp ON (g.user_id = sp.user_id OR (g.user_id IS NULL AND g.student_id = sp.user_id))
         WHERE sp.classroom_id = ? AND g.subject = ?`
      )
      .get(classroomId, subject) as { average: number | null };
    return result.average || 0;
  },
};
