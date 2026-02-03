import { classroomsQueries } from '../database/queries/classrooms.queries';
import { studentsQueries } from '../database/queries/students.queries';
import { gradesQueries } from '../database/queries/grades.queries';
import { analyticsQueries } from '../database/queries/analytics.queries';
import { Classroom, ClassroomStats, InterventionAlert, Subject } from '../types';

class ClassroomService {
  /**
   * Get all classrooms for a teacher
   */
  getClassroomsByTeacher(teacherId: string): Classroom[] {
    return classroomsQueries.getByTeacherId(teacherId);
  }

  /**
   * Get a classroom by ID
   */
  getClassroom(id: string): Classroom | null {
    return classroomsQueries.getById(id);
  }

  /**
   * Get classroom overview statistics
   */
  getClassroomStats(classroomId: string): ClassroomStats {
    const students = studentsQueries.getByClassroomId(classroomId);
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        averageGrade: 0,
        studentsStruggling: 0,
        studentsExcelling: 0,
        recentActivity: 0,
      };
    }

    // Calculate average grade across all subjects
    let totalGradeSum = 0;
    let totalGradeCount = 0;
    let studentsStruggling = 0;
    let studentsExcelling = 0;

    for (const student of students) {
      // Check grades
      const grades = gradesQueries.getRecentByStudentId(student.id, 10);
      if (grades.length > 0) {
        const studentAvg = grades.reduce((sum, g) => sum + (g.grade / g.maxGrade) * 100, 0) / grades.length;
        totalGradeSum += studentAvg;
        totalGradeCount++;

        if (studentAvg >= 90) studentsExcelling++;
        else if (studentAvg < 70) studentsStruggling++;
      }

      // Check learning analytics for struggling students
      const activity = analyticsQueries.getStudentActivity(student.id);
      if (activity.needsIntervention && !grades.some(g => (g.grade / g.maxGrade) * 100 < 70)) {
        // Student struggling with AI but grades don't reflect it yet
        studentsStruggling++;
      }
    }

    // Count recent sessions (last 7 days)
    // This is a simplified count - in production we'd query the database directly
    let recentActivity = 0;
    for (const student of students) {
      const activity = analyticsQueries.getStudentActivity(student.id);
      recentActivity += activity.recentSessions.filter(
        s => new Date(s.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;
    }

    return {
      totalStudents,
      averageGrade: totalGradeCount > 0 ? Math.round(totalGradeSum / totalGradeCount * 10) / 10 : 0,
      studentsStruggling,
      studentsExcelling,
      recentActivity,
    };
  }

  /**
   * Get students needing intervention in teacher's classrooms
   */
  getStudentsNeedingIntervention(teacherId: string): InterventionAlert[] {
    return analyticsQueries.getStudentsNeedingIntervention(teacherId);
  }

  /**
   * Get class average for a subject
   */
  getSubjectAverage(classroomId: string, subject: Subject): number {
    return gradesQueries.getClassAverageBySubject(classroomId, subject);
  }

  /**
   * Create a new classroom
   */
  createClassroom(data: {
    name: string;
    teacherId: string;
    subject?: string;
    gradeLevel?: string;
  }): Classroom {
    return classroomsQueries.create(data);
  }

  /**
   * Update a classroom
   */
  updateClassroom(
    id: string,
    data: {
      name?: string;
      subject?: string;
      gradeLevel?: string;
    }
  ): Classroom | null {
    return classroomsQueries.update(id, data);
  }

  /**
   * Delete a classroom
   */
  deleteClassroom(id: string): boolean {
    return classroomsQueries.delete(id);
  }
}

export const classroomService = new ClassroomService();
