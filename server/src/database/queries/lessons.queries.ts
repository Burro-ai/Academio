import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  Lesson,
  LessonWithTeacher,
  PersonalizedLesson,
  PersonalizedLessonWithDetails,
  LessonRow,
  PersonalizedLessonRow,
} from '../../types';

/**
 * Convert database row to Lesson object
 */
const rowToLesson = (row: LessonRow): Lesson => ({
  id: row.id,
  teacherId: row.teacher_id,
  title: row.title,
  topic: row.topic,
  subject: row.subject || undefined,
  masterContent: row.master_content,
  classroomId: row.classroom_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

interface LessonWithTeacherRow extends LessonRow {
  teacher_name: string;
  personalized_count: number;
  classroom_name: string | null;
}

interface PersonalizedLessonWithDetailsRow extends PersonalizedLessonRow {
  lesson_title: string;
  lesson_topic: string;
  lesson_subject: string | null;
  teacher_name: string;
}

export const lessonsQueries = {
  /**
   * Create a new lesson
   */
  create(data: {
    teacherId: string;
    title: string;
    topic: string;
    subject?: string;
    masterContent: string;
    classroomId?: string;
  }): Lesson {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO lessons (id, teacher_id, title, topic, subject, master_content, classroom_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, data.teacherId, data.title, data.topic, data.subject || null, data.masterContent, data.classroomId || null);

    return this.getById(id)!;
  },

  /**
   * Get lesson by ID
   */
  getById(id: string): Lesson | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM lessons WHERE id = ?')
      .get(id) as LessonRow | undefined;

    if (!row) return null;
    return rowToLesson(row);
  },

  /**
   * Get lesson with teacher info
   */
  getWithTeacher(id: string): LessonWithTeacher | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT
          l.*,
          u.name as teacher_name,
          c.name as classroom_name,
          (SELECT COUNT(*) FROM personalized_lessons WHERE lesson_id = l.id) as personalized_count
        FROM lessons l
        JOIN users u ON l.teacher_id = u.id
        LEFT JOIN classrooms c ON l.classroom_id = c.id
        WHERE l.id = ?
      `)
      .get(id) as LessonWithTeacherRow | undefined;

    if (!row) return null;

    return {
      ...rowToLesson(row),
      teacherName: row.teacher_name,
      personalizedCount: row.personalized_count,
      classroomName: row.classroom_name || undefined,
    };
  },

  /**
   * Get all lessons by teacher
   */
  getByTeacherId(teacherId: string): LessonWithTeacher[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          l.*,
          u.name as teacher_name,
          c.name as classroom_name,
          (SELECT COUNT(*) FROM personalized_lessons WHERE lesson_id = l.id) as personalized_count
        FROM lessons l
        JOIN users u ON l.teacher_id = u.id
        LEFT JOIN classrooms c ON l.classroom_id = c.id
        WHERE l.teacher_id = ?
        ORDER BY l.created_at DESC
      `)
      .all(teacherId) as LessonWithTeacherRow[];

    return rows.map((row) => ({
      ...rowToLesson(row),
      teacherName: row.teacher_name,
      personalizedCount: row.personalized_count,
      classroomName: row.classroom_name || undefined,
    }));
  },

  /**
   * Get lessons by classroom ID
   */
  getByClassroomId(classroomId: string): LessonWithTeacher[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          l.*,
          u.name as teacher_name,
          c.name as classroom_name,
          (SELECT COUNT(*) FROM personalized_lessons WHERE lesson_id = l.id) as personalized_count
        FROM lessons l
        JOIN users u ON l.teacher_id = u.id
        LEFT JOIN classrooms c ON l.classroom_id = c.id
        WHERE l.classroom_id = ?
        ORDER BY l.created_at DESC
      `)
      .all(classroomId) as LessonWithTeacherRow[];

    return rows.map((row) => ({
      ...rowToLesson(row),
      teacherName: row.teacher_name,
      personalizedCount: row.personalized_count,
      classroomName: row.classroom_name || undefined,
    }));
  },

  /**
   * Update lesson
   */
  update(
    id: string,
    data: Partial<{
      title: string;
      topic: string;
      subject: string;
      masterContent: string;
      classroomId: string | null;
    }>
  ): Lesson | null {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.topic !== undefined) {
      updates.push('topic = ?');
      values.push(data.topic);
    }
    if (data.subject !== undefined) {
      updates.push('subject = ?');
      values.push(data.subject);
    }
    if (data.masterContent !== undefined) {
      updates.push('master_content = ?');
      values.push(data.masterContent);
    }
    if (data.classroomId !== undefined) {
      updates.push('classroom_id = ?');
      values.push(data.classroomId);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.getById(id);
  },

  /**
   * Delete lesson
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // Personalized Lessons

  /**
   * Create personalized lesson
   */
  createPersonalized(data: {
    lessonId: string;
    studentId: string;
    personalizedContent: string;
  }): PersonalizedLesson {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO personalized_lessons (id, lesson_id, student_id, personalized_content, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, data.lessonId, data.studentId, data.personalizedContent);

    const row = db
      .prepare('SELECT * FROM personalized_lessons WHERE id = ?')
      .get(id) as PersonalizedLessonRow;

    return {
      id: row.id,
      lessonId: row.lesson_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      viewedAt: row.viewed_at || undefined,
      createdAt: row.created_at,
    };
  },

  /**
   * Get personalized lesson by lesson ID and student ID
   */
  getPersonalizedByLessonAndStudent(
    lessonId: string,
    studentId: string
  ): PersonalizedLesson | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM personalized_lessons WHERE lesson_id = ? AND student_id = ?')
      .get(lessonId, studentId) as PersonalizedLessonRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      lessonId: row.lesson_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      viewedAt: row.viewed_at || undefined,
      createdAt: row.created_at,
    };
  },

  /**
   * Get all personalized lessons for a student
   * IMPORTANT: Only returns lessons from the student's assigned teacher
   */
  getPersonalizedByStudentId(studentId: string): PersonalizedLessonWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          pl.*,
          l.title as lesson_title,
          l.topic as lesson_topic,
          l.subject as lesson_subject,
          u.name as teacher_name
        FROM personalized_lessons pl
        JOIN lessons l ON pl.lesson_id = l.id
        JOIN users u ON l.teacher_id = u.id
        LEFT JOIN student_profiles sp ON sp.user_id = pl.student_id
        WHERE pl.student_id = ?
          AND (sp.teacher_id IS NULL OR l.teacher_id = sp.teacher_id)
        ORDER BY pl.created_at DESC
      `)
      .all(studentId) as PersonalizedLessonWithDetailsRow[];

    return rows.map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      viewedAt: row.viewed_at || undefined,
      createdAt: row.created_at,
      lesson: {
        title: row.lesson_title,
        topic: row.lesson_topic,
        subject: row.lesson_subject || undefined,
        teacherName: row.teacher_name,
      },
    }));
  },

  /**
   * Mark personalized lesson as viewed
   */
  markAsViewed(id: string): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE personalized_lessons SET viewed_at = datetime('now') WHERE id = ?")
      .run(id);
    return result.changes > 0;
  },

  /**
   * Delete all personalized versions of a lesson
   */
  deleteAllPersonalized(lessonId: string): number {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM personalized_lessons WHERE lesson_id = ?')
      .run(lessonId);
    return result.changes;
  },
};
