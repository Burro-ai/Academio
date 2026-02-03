import { studentsQueries } from '../database/queries/students.queries';
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
   */
  getStudentProfile(studentId: string): {
    student: StudentWithDetails;
    gradesBySubject: GradesBySubject[];
    activity: StudentActivity;
  } | null {
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
