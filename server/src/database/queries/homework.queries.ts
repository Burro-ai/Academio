import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  HomeworkAssignment,
  HomeworkWithTeacher,
  PersonalizedHomework,
  PersonalizedHomeworkWithDetails,
  HomeworkRow,
  PersonalizedHomeworkRow,
  HomeworkQuestionJson,
} from '../../types';

/**
 * Safely parse JSON questions array
 */
const parseQuestionsJson = (jsonStr: string | null): HomeworkQuestionJson[] | undefined => {
  if (!jsonStr) return undefined;
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Convert database row to HomeworkAssignment object
 */
const rowToHomework = (row: HomeworkRow): HomeworkAssignment => ({
  id: row.id,
  teacherId: row.teacher_id,
  title: row.title,
  topic: row.topic,
  subject: row.subject || undefined,
  masterContent: row.master_content,
  questionsJson: parseQuestionsJson(row.questions_json),
  dueDate: row.due_date || undefined,
  classroomId: row.classroom_id || undefined,
  assignedAt: (row as HomeworkRow & { assigned_at?: string }).assigned_at || undefined,
  sourceLessonId: row.source_lesson_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

interface HomeworkWithTeacherRow extends HomeworkRow {
  teacher_name: string;
  personalized_count: number;
  classroom_name: string | null;
}

interface PersonalizedHomeworkWithDetailsRow extends PersonalizedHomeworkRow {
  homework_title: string;
  homework_topic: string;
  homework_subject: string | null;
  homework_due_date: string | null;
  homework_questions_json: string | null;
  teacher_name: string;
}

export const homeworkQueries = {
  /**
   * Create a new homework assignment
   */
  create(data: {
    teacherId: string;
    title: string;
    topic: string;
    subject?: string;
    masterContent: string;
    questionsJson?: HomeworkQuestionJson[];
    dueDate?: string;
    classroomId?: string;
    sourceLessonId?: string;
  }): HomeworkAssignment {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO homework_assignments (id, teacher_id, title, topic, subject, master_content, questions_json, due_date, classroom_id, source_lesson_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      data.teacherId,
      data.title,
      data.topic,
      data.subject || null,
      data.masterContent,
      data.questionsJson ? JSON.stringify(data.questionsJson) : null,
      data.dueDate || null,
      data.classroomId || null,
      data.sourceLessonId || null
    );

    return this.getById(id)!;
  },

  /**
   * Get homework by ID
   */
  getById(id: string): HomeworkAssignment | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM homework_assignments WHERE id = ?')
      .get(id) as HomeworkRow | undefined;

    if (!row) return null;
    return rowToHomework(row);
  },

  /**
   * Get homework with teacher info
   */
  getWithTeacher(id: string): HomeworkWithTeacher | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT
          h.*,
          u.name as teacher_name,
          c.name as classroom_name,
          (SELECT COUNT(*) FROM personalized_homework WHERE homework_id = h.id) as personalized_count
        FROM homework_assignments h
        JOIN users u ON h.teacher_id = u.id
        LEFT JOIN classrooms c ON h.classroom_id = c.id
        WHERE h.id = ?
      `)
      .get(id) as HomeworkWithTeacherRow | undefined;

    if (!row) return null;

    return {
      ...rowToHomework(row),
      teacherName: row.teacher_name,
      personalizedCount: row.personalized_count,
      classroomName: row.classroom_name || undefined,
    };
  },

  /**
   * Get all homework by teacher
   */
  getByTeacherId(teacherId: string): HomeworkWithTeacher[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          h.*,
          u.name as teacher_name,
          c.name as classroom_name,
          (SELECT COUNT(*) FROM personalized_homework WHERE homework_id = h.id) as personalized_count
        FROM homework_assignments h
        JOIN users u ON h.teacher_id = u.id
        LEFT JOIN classrooms c ON h.classroom_id = c.id
        WHERE h.teacher_id = ?
        ORDER BY h.created_at DESC
      `)
      .all(teacherId) as HomeworkWithTeacherRow[];

    return rows.map((row) => ({
      ...rowToHomework(row),
      teacherName: row.teacher_name,
      personalizedCount: row.personalized_count,
      classroomName: row.classroom_name || undefined,
    }));
  },

  /**
   * Get homework by classroom ID
   */
  getByClassroomId(classroomId: string): HomeworkWithTeacher[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          h.*,
          u.name as teacher_name,
          c.name as classroom_name,
          (SELECT COUNT(*) FROM personalized_homework WHERE homework_id = h.id) as personalized_count
        FROM homework_assignments h
        JOIN users u ON h.teacher_id = u.id
        LEFT JOIN classrooms c ON h.classroom_id = c.id
        WHERE h.classroom_id = ?
        ORDER BY h.due_date ASC, h.created_at DESC
      `)
      .all(classroomId) as HomeworkWithTeacherRow[];

    return rows.map((row) => ({
      ...rowToHomework(row),
      teacherName: row.teacher_name,
      personalizedCount: row.personalized_count,
      classroomName: row.classroom_name || undefined,
    }));
  },

  /**
   * Update homework
   */
  update(
    id: string,
    data: Partial<{
      title: string;
      topic: string;
      subject: string;
      masterContent: string;
      dueDate: string;
      classroomId: string | null;
    }>
  ): HomeworkAssignment | null {
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
    if (data.dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(data.dueDate);
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

    db.prepare(`UPDATE homework_assignments SET ${updates.join(', ')} WHERE id = ?`).run(
      ...values
    );

    return this.getById(id);
  },

  /**
   * Delete homework
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM homework_assignments WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // Personalized Homework

  /**
   * Create personalized homework
   */
  createPersonalized(data: {
    homeworkId: string;
    studentId: string;
    personalizedContent: string;
    questionsJson?: HomeworkQuestionJson[];
  }): PersonalizedHomework {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO personalized_homework (id, homework_id, student_id, personalized_content, questions_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      data.homeworkId,
      data.studentId,
      data.personalizedContent,
      data.questionsJson ? JSON.stringify(data.questionsJson) : null
    );

    const row = db
      .prepare('SELECT * FROM personalized_homework WHERE id = ?')
      .get(id) as PersonalizedHomeworkRow;

    return {
      id: row.id,
      homeworkId: row.homework_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      questionsJson: parseQuestionsJson(row.questions_json),
      submittedAt: row.submitted_at || undefined,
      createdAt: row.created_at,
    };
  },

  /**
   * Get personalized homework by homework ID and student ID
   */
  getPersonalizedByHomeworkAndStudent(
    homeworkId: string,
    studentId: string
  ): PersonalizedHomework | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM personalized_homework WHERE homework_id = ? AND student_id = ?')
      .get(homeworkId, studentId) as PersonalizedHomeworkRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      homeworkId: row.homework_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      questionsJson: parseQuestionsJson(row.questions_json),
      submittedAt: row.submitted_at || undefined,
      createdAt: row.created_at,
    };
  },

  /**
   * Get all personalized homework for a student
   * IMPORTANT: Only returns homework from the student's assigned teacher
   */
  getPersonalizedByStudentId(studentId: string): PersonalizedHomeworkWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          ph.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          h.due_date as homework_due_date,
          h.questions_json as homework_questions_json,
          u.name as teacher_name
        FROM personalized_homework ph
        JOIN homework_assignments h ON ph.homework_id = h.id
        JOIN users u ON h.teacher_id = u.id
        LEFT JOIN student_profiles sp ON sp.user_id = ph.student_id
        WHERE ph.student_id = ?
          AND (sp.teacher_id IS NULL OR h.teacher_id = sp.teacher_id)
        ORDER BY h.due_date ASC, ph.created_at DESC
      `)
      .all(studentId) as PersonalizedHomeworkWithDetailsRow[];

    return rows.map((row) => ({
      id: row.id,
      homeworkId: row.homework_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      // Use personalized questions if available, otherwise fall back to master questions
      questionsJson: parseQuestionsJson(row.questions_json) || parseQuestionsJson(row.homework_questions_json),
      submittedAt: row.submitted_at || undefined,
      createdAt: row.created_at,
      homework: {
        title: row.homework_title,
        topic: row.homework_topic,
        subject: row.homework_subject || undefined,
        dueDate: row.homework_due_date || undefined,
        teacherName: row.teacher_name,
        questionsJson: parseQuestionsJson(row.homework_questions_json),
      },
    }));
  },

  /**
   * Mark personalized homework as submitted
   */
  markAsSubmitted(id: string): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE personalized_homework SET submitted_at = datetime('now') WHERE id = ?")
      .run(id);
    return result.changes > 0;
  },

  /**
   * Delete all personalized versions of a homework
   */
  deleteAllPersonalized(homeworkId: string): number {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM personalized_homework WHERE homework_id = ?')
      .run(homeworkId);
    return result.changes;
  },

  // =============================================
  // Question Management Methods (for editable questions)
  // =============================================

  /**
   * Update questions JSON for a homework assignment
   * Only allowed if homework is not yet assigned
   */
  updateQuestions(id: string, questionsJson: HomeworkQuestionJson[]): HomeworkAssignment | null {
    const db = getDb();

    // Check if homework exists and is not assigned
    const existing = this.getById(id);
    if (!existing) return null;

    // Check if already assigned (locked)
    const row = db
      .prepare('SELECT assigned_at FROM homework_assignments WHERE id = ?')
      .get(id) as { assigned_at: string | null } | undefined;

    if (row?.assigned_at) {
      throw new Error('Cannot update questions: homework is already assigned to students');
    }

    db.prepare(`
      UPDATE homework_assignments
      SET questions_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(questionsJson), id);

    return this.getById(id);
  },

  /**
   * Mark homework as assigned (locks questions from editing)
   */
  markAssigned(id: string): HomeworkAssignment | null {
    const db = getDb();

    const existing = this.getById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE homework_assignments
      SET assigned_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    return this.getById(id);
  },

  /**
   * Check if homework is assigned (questions are locked)
   */
  isAssigned(id: string): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT assigned_at FROM homework_assignments WHERE id = ?')
      .get(id) as { assigned_at: string | null } | undefined;

    return !!row?.assigned_at;
  },

  /**
   * Update master content for a homework assignment
   * Only allowed if homework is not yet assigned
   */
  updateMasterContent(id: string, masterContent: string): HomeworkAssignment | null {
    const db = getDb();

    // Check if homework exists and is not assigned
    const existing = this.getById(id);
    if (!existing) return null;

    // Check if already assigned (locked)
    const row = db
      .prepare('SELECT assigned_at FROM homework_assignments WHERE id = ?')
      .get(id) as { assigned_at: string | null } | undefined;

    if (row?.assigned_at) {
      throw new Error('Cannot update content: homework is already assigned to students');
    }

    db.prepare(`
      UPDATE homework_assignments
      SET master_content = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(masterContent, id);

    return this.getById(id);
  },

  /**
   * Get personalized homework by ID with full homework details
   */
  getPersonalizedById(id: string): PersonalizedHomeworkWithDetails | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT
          ph.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          h.due_date as homework_due_date,
          h.questions_json as homework_questions_json,
          u.name as teacher_name
        FROM personalized_homework ph
        JOIN homework_assignments h ON ph.homework_id = h.id
        JOIN users u ON h.teacher_id = u.id
        WHERE ph.id = ?
      `)
      .get(id) as PersonalizedHomeworkWithDetailsRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      homeworkId: row.homework_id,
      studentId: row.student_id,
      personalizedContent: row.personalized_content,
      questionsJson: parseQuestionsJson(row.questions_json) || parseQuestionsJson(row.homework_questions_json),
      submittedAt: row.submitted_at || undefined,
      createdAt: row.created_at,
      homework: {
        title: row.homework_title,
        topic: row.homework_topic,
        subject: row.homework_subject || undefined,
        dueDate: row.homework_due_date || undefined,
        teacherName: row.teacher_name,
        questionsJson: parseQuestionsJson(row.homework_questions_json),
      },
    };
  },
};
