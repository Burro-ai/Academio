import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database row types
 */
interface HomeworkSubmissionRow {
  id: string;
  personalized_homework_id: string;
  student_id: string;
  answers: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  ai_suggested_grade: number | null;
  ai_suggested_feedback: string | null;
  rubric_scores: string | null;  // JSON: { accuracy, reasoning, effort }
  graded_by: string | null;
  graded_at: string | null;
}

interface HomeworkSubmissionWithDetailsRow extends HomeworkSubmissionRow {
  homework_title: string;
  homework_topic: string;
  homework_subject: string | null;
  student_name: string;
  student_email: string;
  personalized_content: string;
}

/**
 * Application types
 */
export interface HomeworkAnswer {
  questionId: string;
  value: string;
}

export interface RubricScores {
  accuracy: number;
  reasoning: number;
  effort: number;
}

export interface HomeworkSubmission {
  id: string;
  personalizedHomeworkId: string;
  studentId: string;
  answers: HomeworkAnswer[];
  submittedAt: string;
  grade?: number;
  feedback?: string;
  aiSuggestedGrade?: number;
  aiSuggestedFeedback?: string;
  rubricScores?: RubricScores;
  gradedBy?: string;
  gradedAt?: string;
}

export interface HomeworkSubmissionWithDetails extends HomeworkSubmission {
  homeworkTitle: string;
  homeworkTopic: string;
  homeworkSubject?: string;
  studentName: string;
  studentEmail: string;
  personalizedContent: string;
}

/**
 * Convert row to submission object
 */
const rowToSubmission = (row: HomeworkSubmissionRow): HomeworkSubmission => {
  let rubricScores: RubricScores | undefined;
  if (row.rubric_scores) {
    try {
      rubricScores = JSON.parse(row.rubric_scores) as RubricScores;
    } catch {
      // ignore malformed JSON
    }
  }

  return {
    id: row.id,
    personalizedHomeworkId: row.personalized_homework_id,
    studentId: row.student_id,
    answers: JSON.parse(row.answers) as HomeworkAnswer[],
    submittedAt: row.submitted_at,
    grade: row.grade ?? undefined,
    feedback: row.feedback ?? undefined,
    aiSuggestedGrade: row.ai_suggested_grade ?? undefined,
    aiSuggestedFeedback: row.ai_suggested_feedback ?? undefined,
    rubricScores,
    gradedBy: row.graded_by ?? undefined,
    gradedAt: row.graded_at ?? undefined,
  };
};

export const homeworkSubmissionsQueries = {
  /**
   * Create a new homework submission
   */
  create(
    personalizedHomeworkId: string,
    studentId: string,
    answers: HomeworkAnswer[]
  ): HomeworkSubmission {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const answersJson = JSON.stringify(answers);

    db.prepare(`
      INSERT INTO homework_submissions (id, personalized_homework_id, student_id, answers, submitted_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, personalizedHomeworkId, studentId, answersJson, now);

    return {
      id,
      personalizedHomeworkId,
      studentId,
      answers,
      submittedAt: now,
    };
  },

  /**
   * Get submission by ID
   */
  getById(id: string): HomeworkSubmission | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM homework_submissions WHERE id = ?')
      .get(id) as HomeworkSubmissionRow | undefined;

    if (!row) return null;
    return rowToSubmission(row);
  },

  /**
   * Get submission by homework and student
   */
  getByHomeworkAndStudent(
    personalizedHomeworkId: string,
    studentId: string
  ): HomeworkSubmission | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT * FROM homework_submissions
        WHERE personalized_homework_id = ? AND student_id = ?
      `)
      .get(personalizedHomeworkId, studentId) as HomeworkSubmissionRow | undefined;

    if (!row) return null;
    return rowToSubmission(row);
  },

  /**
   * Get all pending (ungraded) submissions for a teacher
   */
  getPendingByTeacher(teacherId: string): HomeworkSubmissionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          hs.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          u.name as student_name,
          u.email as student_email,
          ph.personalized_content
        FROM homework_submissions hs
        JOIN personalized_homework ph ON hs.personalized_homework_id = ph.id
        JOIN homework_assignments h ON ph.homework_id = h.id
        JOIN users u ON hs.student_id = u.id
        WHERE h.teacher_id = ? AND hs.graded_at IS NULL
        ORDER BY hs.submitted_at ASC
      `)
      .all(teacherId) as HomeworkSubmissionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSubmission(row),
      homeworkTitle: row.homework_title,
      homeworkTopic: row.homework_topic,
      homeworkSubject: row.homework_subject ?? undefined,
      studentName: row.student_name,
      studentEmail: row.student_email,
      personalizedContent: row.personalized_content,
    }));
  },

  /**
   * Get all submissions for a homework assignment
   */
  getAllByHomework(homeworkId: string): HomeworkSubmissionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          hs.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          u.name as student_name,
          u.email as student_email,
          ph.personalized_content
        FROM homework_submissions hs
        JOIN personalized_homework ph ON hs.personalized_homework_id = ph.id
        JOIN homework_assignments h ON ph.homework_id = h.id
        JOIN users u ON hs.student_id = u.id
        WHERE h.id = ?
        ORDER BY hs.submitted_at ASC
      `)
      .all(homeworkId) as HomeworkSubmissionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSubmission(row),
      homeworkTitle: row.homework_title,
      homeworkTopic: row.homework_topic,
      homeworkSubject: row.homework_subject ?? undefined,
      studentName: row.student_name,
      studentEmail: row.student_email,
      personalizedContent: row.personalized_content,
    }));
  },

  /**
   * Get all submissions by a student
   */
  getByStudent(studentId: string): HomeworkSubmissionWithDetails[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          hs.*,
          h.title as homework_title,
          h.topic as homework_topic,
          h.subject as homework_subject,
          u.name as student_name,
          u.email as student_email,
          ph.personalized_content
        FROM homework_submissions hs
        JOIN personalized_homework ph ON hs.personalized_homework_id = ph.id
        JOIN homework_assignments h ON ph.homework_id = h.id
        JOIN users u ON hs.student_id = u.id
        WHERE hs.student_id = ?
        ORDER BY hs.submitted_at DESC
      `)
      .all(studentId) as HomeworkSubmissionWithDetailsRow[];

    return rows.map((row) => ({
      ...rowToSubmission(row),
      homeworkTitle: row.homework_title,
      homeworkTopic: row.homework_topic,
      homeworkSubject: row.homework_subject ?? undefined,
      studentName: row.student_name,
      studentEmail: row.student_email,
      personalizedContent: row.personalized_content,
    }));
  },

  /**
   * Update grade and feedback for a submission
   */
  updateGrade(
    submissionId: string,
    grade: number,
    feedback: string,
    gradedBy: string
  ): HomeworkSubmission | null {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE homework_submissions
      SET grade = ?, feedback = ?, graded_by = ?, graded_at = ?
      WHERE id = ?
    `).run(grade, feedback, gradedBy, now, submissionId);

    return this.getById(submissionId);
  },

  /**
   * Update AI suggested grade, feedback, and rubric scores
   */
  updateAISuggestion(
    submissionId: string,
    aiGrade: number,
    aiFeedback: string,
    rubricScores?: RubricScores
  ): HomeworkSubmission | null {
    const db = getDb();

    db.prepare(`
      UPDATE homework_submissions
      SET ai_suggested_grade = ?, ai_suggested_feedback = ?, rubric_scores = ?
      WHERE id = ?
    `).run(aiGrade, aiFeedback, rubricScores ? JSON.stringify(rubricScores) : null, submissionId);

    return this.getById(submissionId);
  },

  /**
   * Check if a student has submitted for a homework
   */
  hasSubmitted(personalizedHomeworkId: string, studentId: string): boolean {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT COUNT(*) as count FROM homework_submissions
        WHERE personalized_homework_id = ? AND student_id = ?
      `)
      .get(personalizedHomeworkId, studentId) as { count: number };
    return row.count > 0;
  },

  /**
   * Get submission count for a homework
   */
  countByHomework(homeworkId: string): { total: number; graded: number } {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN hs.graded_at IS NOT NULL THEN 1 ELSE 0 END) as graded
        FROM homework_submissions hs
        JOIN personalized_homework ph ON hs.personalized_homework_id = ph.id
        WHERE ph.homework_id = ?
      `)
      .get(homeworkId) as { total: number; graded: number };
    return { total: row.total, graded: row.graded };
  },

  /**
   * Delete a submission
   */
  delete(submissionId: string): boolean {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM homework_submissions WHERE id = ?')
      .run(submissionId);
    return result.changes > 0;
  },
};
