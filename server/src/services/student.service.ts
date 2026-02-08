import { studentsQueries } from '../database/queries/students.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { gradesQueries } from '../database/queries/grades.queries';
import { analyticsQueries } from '../database/queries/analytics.queries';
import { Student, StudentWithDetails, StudentActivity, GradesBySubject } from '../types';

class StudentService {
  /**
   * Get all students for a teacher
   */
  getStudentsByTeacher(teacherId: string): Student[] {
    return studentsQueries.getByTeacherId(teacherId);
  }

  /**
   * Get all students in a classroom
   */
  getStudentsByClassroom(classroomId: string): Student[] {
    return studentsQueries.getByClassroomId(classroomId);
  }

  /**
   * Get a student's full profile including grades and activity
   * Supports both legacy students table and new unified student_profiles
   */
  getStudentProfile(studentId: string): {
    student: StudentWithDetails;
    gradesBySubject: GradesBySubject[];
    activity: StudentActivity;
  } | null {
    // First try the new unified system (student_profiles + users)
    const profileWithUser = studentProfilesQueries.getWithUserDetails(studentId);
    if (profileWithUser) {
      const gradesBySubject = gradesQueries.getByStudentGroupedBySubject(studentId);
      const activity = analyticsQueries.getStudentActivity(studentId);

      // Convert StudentProfileWithUser to StudentWithDetails format
      const student: StudentWithDetails = {
        id: profileWithUser.userId,
        name: profileWithUser.user.name,
        email: profileWithUser.user.email,
        avatarUrl: profileWithUser.user.avatarUrl,
        gradeLevel: profileWithUser.gradeLevel,
        classroomId: profileWithUser.classroomId,
        createdAt: profileWithUser.createdAt,
        updatedAt: profileWithUser.updatedAt,
        classroom: profileWithUser.classroom,
        currentStruggleScore: 0,
        totalSessions: 0,
        recentGrades: gradesQueries.getRecentByStudentId(studentId, 5),
        // Include profile-specific fields
        age: profileWithUser.age,
        favoriteSports: profileWithUser.favoriteSports,
        skillsToImprove: profileWithUser.skillsToImprove,
        learningSystemPrompt: profileWithUser.learningSystemPrompt,
        teacherId: profileWithUser.teacherId,
      };

      return {
        student,
        gradesBySubject,
        activity,
      };
    }

    // Fallback to legacy students table
    const student = studentsQueries.getByIdWithDetails(studentId);
    if (!student) return null;

    const gradesBySubject = gradesQueries.getByStudentGroupedBySubject(studentId);
    const activity = analyticsQueries.getStudentActivity(studentId);

    // Add recent grades to student
    student.recentGrades = gradesQueries.getRecentByStudentId(studentId, 5);

    return {
      student,
      gradesBySubject,
      activity,
    };
  }

  /**
   * Get student's grade history
   */
  getStudentGrades(studentId: string): GradesBySubject[] {
    return gradesQueries.getByStudentGroupedBySubject(studentId);
  }

  /**
   * Get student's learning activity
   */
  getStudentActivity(studentId: string): StudentActivity {
    return analyticsQueries.getStudentActivity(studentId);
  }

  /**
   * Check if a student needs intervention
   */
  needsIntervention(studentId: string): boolean {
    const activity = analyticsQueries.getStudentActivity(studentId);
    return activity.needsIntervention;
  }

  /**
   * Create a new student
   */
  createStudent(data: {
    name: string;
    email?: string;
    gradeLevel?: string;
    classroomId?: string;
  }): Student {
    return studentsQueries.create(data);
  }

  /**
   * Update a student
   */
  updateStudent(
    id: string,
    data: {
      name?: string;
      email?: string;
      avatarUrl?: string;
      gradeLevel?: string;
      classroomId?: string;
    }
  ): Student | null {
    return studentsQueries.update(id, data);
  }

  /**
   * Delete a student
   */
  deleteStudent(id: string): boolean {
    return studentsQueries.delete(id);
  }
}

export const studentService = new StudentService();
