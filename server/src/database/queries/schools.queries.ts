import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  School,
  SchoolMembership,
  SchoolSettings,
  SchoolPermissions,
  SchoolWithStats,
  SubscriptionTier,
  SchoolMemberRole,
} from '../../types';
import { SchoolRow, SchoolMembershipRow } from '../../types';

/**
 * Convert database row to School object
 */
const rowToSchool = (row: SchoolRow): School => ({
  id: row.id,
  name: row.name,
  domain: row.domain || undefined,
  settings: row.settings ? JSON.parse(row.settings) : {},
  subscriptionTier: row.subscription_tier as SubscriptionTier,
  maxStudents: row.max_students,
  maxTeachers: row.max_teachers,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Convert database row to SchoolMembership object
 */
const rowToMembership = (row: SchoolMembershipRow): SchoolMembership => ({
  id: row.id,
  userId: row.user_id,
  schoolId: row.school_id,
  role: row.role,
  isPrimary: row.is_primary === 1,
  permissions: row.permissions ? JSON.parse(row.permissions) : {},
  joinedAt: row.joined_at,
});

export const schoolsQueries = {
  // ===== SCHOOL CRUD =====

  /**
   * Get all schools
   */
  getAll(): School[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM schools ORDER BY name')
      .all() as SchoolRow[];
    return rows.map(rowToSchool);
  },

  /**
   * Get all active schools
   */
  getAllActive(): School[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM schools WHERE is_active = 1 ORDER BY name')
      .all() as SchoolRow[];
    return rows.map(rowToSchool);
  },

  /**
   * Get school by ID
   */
  getById(id: string): School | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM schools WHERE id = ?')
      .get(id) as SchoolRow | undefined;
    return row ? rowToSchool(row) : null;
  },

  /**
   * Get school by domain
   */
  getByDomain(domain: string): School | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM schools WHERE domain = ?')
      .get(domain) as SchoolRow | undefined;
    return row ? rowToSchool(row) : null;
  },

  /**
   * Get school with member stats
   */
  getWithStats(id: string): SchoolWithStats | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM school_memberships WHERE school_id = s.id AND role = 'STUDENT') as student_count,
          (SELECT COUNT(*) FROM school_memberships WHERE school_id = s.id AND role = 'TEACHER') as teacher_count,
          (SELECT COUNT(*) FROM classrooms WHERE school_id = s.id) as classroom_count
        FROM schools s
        WHERE s.id = ?
      `)
      .get(id) as (SchoolRow & { student_count: number; teacher_count: number; classroom_count: number }) | undefined;

    if (!row) return null;

    return {
      ...rowToSchool(row),
      studentCount: row.student_count,
      teacherCount: row.teacher_count,
      classroomCount: row.classroom_count,
    };
  },

  /**
   * Create a new school
   */
  create(data: {
    name: string;
    domain?: string;
    settings?: SchoolSettings;
    subscriptionTier?: SubscriptionTier;
    maxStudents?: number;
    maxTeachers?: number;
  }): School {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO schools (id, name, domain, settings, subscription_tier, max_students, max_teachers, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      data.name,
      data.domain || null,
      JSON.stringify(data.settings || {}),
      data.subscriptionTier || 'free',
      data.maxStudents || 100,
      data.maxTeachers || 10,
      now,
      now
    );

    return this.getById(id)!;
  },

  /**
   * Update a school
   */
  update(
    id: string,
    data: Partial<{
      name: string;
      domain: string;
      settings: SchoolSettings;
      subscriptionTier: SubscriptionTier;
      maxStudents: number;
      maxTeachers: number;
      isActive: boolean;
    }>
  ): School | null {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.domain !== undefined) {
      updates.push('domain = ?');
      values.push(data.domain);
    }
    if (data.settings !== undefined) {
      updates.push('settings = ?');
      values.push(JSON.stringify(data.settings));
    }
    if (data.subscriptionTier !== undefined) {
      updates.push('subscription_tier = ?');
      values.push(data.subscriptionTier);
    }
    if (data.maxStudents !== undefined) {
      updates.push('max_students = ?');
      values.push(data.maxStudents);
    }
    if (data.maxTeachers !== undefined) {
      updates.push('max_teachers = ?');
      values.push(data.maxTeachers);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE schools SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  /**
   * Delete a school
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM schools WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Soft delete (deactivate) a school
   */
  deactivate(id: string): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE schools SET is_active = 0, updated_at = datetime('now') WHERE id = ?")
      .run(id);
    return result.changes > 0;
  },

  // ===== MEMBERSHIP CRUD =====

  /**
   * Get all memberships for a user
   */
  getMembershipsByUserId(userId: string): SchoolMembership[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM school_memberships WHERE user_id = ? ORDER BY is_primary DESC, joined_at')
      .all(userId) as SchoolMembershipRow[];
    return rows.map(rowToMembership);
  },

  /**
   * Get all members of a school
   */
  getMembershipsBySchoolId(schoolId: string): SchoolMembership[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM school_memberships WHERE school_id = ? ORDER BY role, joined_at')
      .all(schoolId) as SchoolMembershipRow[];
    return rows.map(rowToMembership);
  },

  /**
   * Get members of a school by role
   */
  getMembersByRole(schoolId: string, role: SchoolMemberRole): SchoolMembership[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM school_memberships WHERE school_id = ? AND role = ? ORDER BY joined_at')
      .all(schoolId, role) as SchoolMembershipRow[];
    return rows.map(rowToMembership);
  },

  /**
   * Get a specific membership
   */
  getMembership(userId: string, schoolId: string): SchoolMembership | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM school_memberships WHERE user_id = ? AND school_id = ?')
      .get(userId, schoolId) as SchoolMembershipRow | undefined;
    return row ? rowToMembership(row) : null;
  },

  /**
   * Get primary school for a user
   */
  getPrimarySchool(userId: string): School | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT s.* FROM schools s
        JOIN school_memberships sm ON s.id = sm.school_id
        WHERE sm.user_id = ? AND sm.is_primary = 1
      `)
      .get(userId) as SchoolRow | undefined;
    return row ? rowToSchool(row) : null;
  },

  /**
   * Add a member to a school
   */
  addMember(data: {
    userId: string;
    schoolId: string;
    role: SchoolMemberRole;
    isPrimary?: boolean;
    permissions?: SchoolPermissions;
  }): SchoolMembership {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    // If this is the first membership or marked as primary, unset other primary flags
    if (data.isPrimary) {
      db.prepare('UPDATE school_memberships SET is_primary = 0 WHERE user_id = ?').run(data.userId);
    }

    db.prepare(`
      INSERT INTO school_memberships (id, user_id, school_id, role, is_primary, permissions, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.userId,
      data.schoolId,
      data.role,
      data.isPrimary ? 1 : 0,
      JSON.stringify(data.permissions || {}),
      now
    );

    return this.getMembership(data.userId, data.schoolId)!;
  },

  /**
   * Update a membership
   */
  updateMembership(
    userId: string,
    schoolId: string,
    data: Partial<{
      role: SchoolMemberRole;
      isPrimary: boolean;
      permissions: SchoolPermissions;
    }>
  ): SchoolMembership | null {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.isPrimary !== undefined) {
      // If setting as primary, unset other primary flags
      if (data.isPrimary) {
        db.prepare('UPDATE school_memberships SET is_primary = 0 WHERE user_id = ?').run(userId);
      }
      updates.push('is_primary = ?');
      values.push(data.isPrimary ? 1 : 0);
    }
    if (data.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(data.permissions));
    }

    if (updates.length === 0) {
      return this.getMembership(userId, schoolId);
    }

    values.push(userId, schoolId);
    db.prepare(`UPDATE school_memberships SET ${updates.join(', ')} WHERE user_id = ? AND school_id = ?`).run(...values);

    return this.getMembership(userId, schoolId);
  },

  /**
   * Remove a member from a school
   */
  removeMember(userId: string, schoolId: string): boolean {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM school_memberships WHERE user_id = ? AND school_id = ?')
      .run(userId, schoolId);
    return result.changes > 0;
  },

  /**
   * Check if user is a member of a school
   */
  isMember(userId: string, schoolId: string): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM school_memberships WHERE user_id = ? AND school_id = ?')
      .get(userId, schoolId);
    return !!row;
  },

  /**
   * Check if user has a specific role at a school
   */
  hasRole(userId: string, schoolId: string, role: SchoolMemberRole): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM school_memberships WHERE user_id = ? AND school_id = ? AND role = ?')
      .get(userId, schoolId, role);
    return !!row;
  },

  /**
   * Count members by role
   */
  countMembersByRole(schoolId: string): { students: number; teachers: number; admins: number } {
    const db = getDb();
    const result = db
      .prepare(`
        SELECT
          SUM(CASE WHEN role = 'STUDENT' THEN 1 ELSE 0 END) as students,
          SUM(CASE WHEN role = 'TEACHER' THEN 1 ELSE 0 END) as teachers,
          SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) as admins
        FROM school_memberships
        WHERE school_id = ?
      `)
      .get(schoolId) as { students: number | null; teachers: number | null; admins: number | null };

    return {
      students: result.students || 0,
      teachers: result.teachers || 0,
      admins: result.admins || 0,
    };
  },
};
