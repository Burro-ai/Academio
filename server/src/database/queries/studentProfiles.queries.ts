import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  StudentProfile,
  StudentProfileWithUser,
  UpdateStudentProfileRequest,
  StudentProfileRow,
  PersonalizationContext,
} from '../../types';

interface StudentProfileWithSchool extends StudentProfile {
  schoolId?: string;
}

/**
 * Convert database row to StudentProfile object
 */
const rowToProfile = (row: StudentProfileRow): StudentProfileWithSchool => ({
  id: row.id,
  userId: row.user_id,
  age: row.age || undefined,
  favoriteSports: row.favorite_sports ? JSON.parse(row.favorite_sports) : undefined,
  skillsToImprove: row.skills_to_improve ? JSON.parse(row.skills_to_improve) : undefined,
  gradeHistory: row.grade_history ? JSON.parse(row.grade_history) : undefined,
  learningSystemPrompt: row.learning_system_prompt || undefined,
  gradeLevel: row.grade_level || undefined,
  classroomId: row.classroom_id || undefined,
  teacherId: row.teacher_id || undefined,
  schoolId: row.school_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

interface ProfileWithUserRow extends StudentProfileRow {
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
  classroom_name: string | null;
  classroom_subject: string | null;
}

export const studentProfilesQueries = {
  /**
   * Get profile by user ID
   */
  getByUserId(userId: string): StudentProfile | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM student_profiles WHERE user_id = ?')
      .get(userId) as StudentProfileRow | undefined;

    if (!row) return null;
    return rowToProfile(row);
  },

  /**
   * Get profile by profile ID
   */
  getById(id: string): StudentProfile | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM student_profiles WHERE id = ?')
      .get(id) as StudentProfileRow | undefined;

    if (!row) return null;
    return rowToProfile(row);
  },

  /**
   * Get profile with user and classroom details
   */
  getWithUserDetails(userId: string): StudentProfileWithUser | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT
          sp.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar_url as user_avatar_url,
          c.name as classroom_name,
          c.subject as classroom_subject
        FROM student_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN classrooms c ON sp.classroom_id = c.id
        WHERE sp.user_id = ?
      `)
      .get(userId) as ProfileWithUserRow | undefined;

    if (!row) return null;

    return {
      ...rowToProfile(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatarUrl: row.user_avatar_url || undefined,
      },
      classroom: row.classroom_id
        ? {
            id: row.classroom_id,
            name: row.classroom_name || '',
            subject: row.classroom_subject || undefined,
          }
        : undefined,
    };
  },

  /**
   * Create a new student profile (with optional school_id)
   */
  create(
    userId: string,
    data?: Partial<UpdateStudentProfileRequest> & { schoolId?: string }
  ): StudentProfile {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO student_profiles (
        id, user_id, age, favorite_sports, skills_to_improve,
        learning_system_prompt, grade_level, classroom_id, school_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      userId,
      data?.age || null,
      data?.favoriteSports ? JSON.stringify(data.favoriteSports) : null,
      data?.skillsToImprove ? JSON.stringify(data.skillsToImprove) : null,
      data?.learningSystemPrompt || null,
      data?.gradeLevel || null,
      data?.classroomId || null,
      data?.schoolId || null
    );

    return this.getById(id)!;
  },

  /**
   * Update student profile
   */
  update(userId: string, data: UpdateStudentProfileRequest): StudentProfile | null {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.age !== undefined) {
      updates.push('age = ?');
      values.push(data.age);
    }
    if (data.favoriteSports !== undefined) {
      updates.push('favorite_sports = ?');
      values.push(JSON.stringify(data.favoriteSports));
    }
    if (data.skillsToImprove !== undefined) {
      updates.push('skills_to_improve = ?');
      values.push(JSON.stringify(data.skillsToImprove));
    }
    if (data.learningSystemPrompt !== undefined) {
      updates.push('learning_system_prompt = ?');
      values.push(data.learningSystemPrompt);
    }
    if (data.gradeLevel !== undefined) {
      updates.push('grade_level = ?');
      values.push(data.gradeLevel);
    }
    if (data.classroomId !== undefined) {
      updates.push('classroom_id = ?');
      values.push(data.classroomId);
    }

    if (updates.length === 0) {
      return this.getByUserId(userId);
    }

    updates.push("updated_at = datetime('now')");
    values.push(userId);

    db.prepare(`UPDATE student_profiles SET ${updates.join(', ')} WHERE user_id = ?`).run(
      ...values
    );

    return this.getByUserId(userId);
  },

  /**
   * Get all student profiles
   */
  getAll(): StudentProfile[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM student_profiles ORDER BY created_at DESC')
      .all() as StudentProfileRow[];

    return rows.map(rowToProfile);
  },

  /**
   * Get all profiles with user details (for teacher dashboard)
   */
  getAllWithUserDetails(): StudentProfileWithUser[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          sp.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar_url as user_avatar_url,
          c.name as classroom_name,
          c.subject as classroom_subject
        FROM student_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN classrooms c ON sp.classroom_id = c.id
        ORDER BY u.name
      `)
      .all() as ProfileWithUserRow[];

    return rows.map((row) => ({
      ...rowToProfile(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatarUrl: row.user_avatar_url || undefined,
      },
      classroom: row.classroom_id
        ? {
            id: row.classroom_id,
            name: row.classroom_name || '',
            subject: row.classroom_subject || undefined,
          }
        : undefined,
    }));
  },

  /**
   * Get profiles by classroom ID
   */
  getByClassroomId(classroomId: string): StudentProfile[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM student_profiles WHERE classroom_id = ?')
      .all(classroomId) as StudentProfileRow[];

    return rows.map(rowToProfile);
  },

  /**
   * Get personalization context for AI
   */
  getPersonalizationContext(userId: string): PersonalizationContext | null {
    const profile = this.getByUserId(userId);
    if (!profile) return null;

    return {
      age: profile.age,
      interests: profile.favoriteSports || [],
      skillsToImprove: profile.skillsToImprove || [],
      learningSystemPrompt: profile.learningSystemPrompt,
    };
  },

  /**
   * Set teacher for a student
   */
  setTeacher(userId: string, teacherId: string | null): StudentProfile | null {
    const db = getDb();
    db.prepare(`
      UPDATE student_profiles
      SET teacher_id = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(teacherId, userId);

    return this.getByUserId(userId);
  },

  /**
   * Get profiles by teacher ID (students who selected this teacher)
   */
  getByTeacherId(teacherId: string): StudentProfileWithUser[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          sp.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar_url as user_avatar_url,
          c.name as classroom_name,
          c.subject as classroom_subject
        FROM student_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN classrooms c ON sp.classroom_id = c.id
        WHERE sp.teacher_id = ?
        ORDER BY u.name
      `)
      .all(teacherId) as ProfileWithUserRow[];

    return rows.map((row) => ({
      ...rowToProfile(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatarUrl: row.user_avatar_url || undefined,
      },
      classroom: row.classroom_id
        ? {
            id: row.classroom_id,
            name: row.classroom_name || '',
            subject: row.classroom_subject || undefined,
          }
        : undefined,
    }));
  },

  /**
   * Delete profile
   */
  delete(userId: string): boolean {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM student_profiles WHERE user_id = ?')
      .run(userId);
    return result.changes > 0;
  },

  /**
   * Get profiles by school ID
   */
  getBySchoolId(schoolId: string): StudentProfile[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM student_profiles WHERE school_id = ? ORDER BY created_at DESC')
      .all(schoolId) as StudentProfileRow[];
    return rows.map(rowToProfile);
  },

  /**
   * Get profiles with user details by school ID (for teacher dashboard)
   */
  getAllWithUserDetailsBySchoolId(schoolId: string): StudentProfileWithUser[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT
          sp.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar_url as user_avatar_url,
          c.name as classroom_name,
          c.subject as classroom_subject
        FROM student_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN classrooms c ON sp.classroom_id = c.id
        WHERE sp.school_id = ?
        ORDER BY u.name
      `)
      .all(schoolId) as ProfileWithUserRow[];

    return rows.map((row) => ({
      ...rowToProfile(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatarUrl: row.user_avatar_url || undefined,
      },
      classroom: row.classroom_id
        ? {
            id: row.classroom_id,
            name: row.classroom_name || '',
            subject: row.classroom_subject || undefined,
          }
        : undefined,
    }));
  },

  /**
   * Update profile's school
   */
  updateSchool(userId: string, schoolId: string | null): StudentProfile | null {
    const db = getDb();
    db.prepare(`
      UPDATE student_profiles
      SET school_id = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(schoolId, userId);
    return this.getByUserId(userId);
  },
};
