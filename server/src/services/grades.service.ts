import { gradesQueries } from '../database/queries/grades.queries';
import { StudentGrade, Subject, AssignmentType, GradesBySubject, AddGradeRequest } from '../types';

class GradesService {
  /**
   * Get all grades for a student
   */
  getStudentGrades(studentId: string): StudentGrade[] {
    return gradesQueries.getByStudentId(studentId);
  }

  /**
   * Get grades grouped by subject
   */
  getGradesBySubject(studentId: string): GradesBySubject[] {
    return gradesQueries.getByStudentGroupedBySubject(studentId);
  }

  /**
   * Get grades for a specific subject
   */
  getGradesForSubject(studentId: string, subject: Subject): StudentGrade[] {
    return gradesQueries.getByStudentAndSubject(studentId, subject);
  }

  /**
   * Get recent grades
   */
  getRecentGrades(studentId: string, limit: number = 10): StudentGrade[] {
    return gradesQueries.getRecentByStudentId(studentId, limit);
  }

  /**
   * Add a new grade
   */
  addGrade(data: AddGradeRequest): StudentGrade {
    return gradesQueries.create({
      userId: data.studentId,
      subject: data.subject,
      grade: data.grade,
      maxGrade: data.maxGrade,
      assignmentName: data.assignmentName,
      assignmentType: data.assignmentType,
    });
  }

  /**
   * Update a grade
   */
  updateGrade(
    id: string,
    data: {
      grade?: number;
      maxGrade?: number;
      assignmentName?: string;
      assignmentType?: AssignmentType;
    }
  ): StudentGrade | null {
    return gradesQueries.update(id, data);
  }

  /**
   * Delete a grade
   */
  deleteGrade(id: string): boolean {
    return gradesQueries.delete(id);
  }

  /**
   * Calculate student's overall average
   */
  calculateOverallAverage(studentId: string): number {
    const grades = gradesQueries.getByStudentId(studentId);
    if (grades.length === 0) return 0;

    const sum = grades.reduce((acc, g) => acc + (g.grade / g.maxGrade) * 100, 0);
    return Math.round(sum / grades.length * 10) / 10;
  }

  /**
   * Get class average for a subject
   */
  getClassSubjectAverage(classroomId: string, subject: Subject): number {
    return gradesQueries.getClassAverageBySubject(classroomId, subject);
  }
}

export const gradesService = new GradesService();
