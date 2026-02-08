import { useState, useCallback, useEffect } from 'react';
import {
  Student,
  StudentProfileWithUser,
  StudentWithDetails,
  GradesBySubject,
  StudentActivity,
  AddGradeRequest,
  CreateStudentRequest,
  StudentGrade,
} from '@/types';
import { teacherApi } from '@/services/teacherApi';

interface UseStudentsReturn {
  students: (Student | StudentProfileWithUser)[];
  selectedStudent: StudentWithDetails | null;
  studentGrades: GradesBySubject[];
  studentActivity: StudentActivity | null;
  isLoading: boolean;
  error: string | null;
  loadStudents: (classroomId?: string) => Promise<void>;
  selectStudent: (id: string | null) => Promise<void>;
  createStudent: (data: CreateStudentRequest) => Promise<Student>;
  updateStudent: (id: string, data: Partial<CreateStudentRequest>) => Promise<Student>;
  deleteStudent: (id: string) => Promise<void>;
  addGrade: (studentId: string, data: Omit<AddGradeRequest, 'studentId'>) => Promise<StudentGrade>;
  refreshStudent: () => Promise<void>;
}

export function useStudents(initialClassroomId?: string): UseStudentsReturn {
  const [students, setStudents] = useState<(Student | StudentProfileWithUser)[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [studentGrades, setStudentGrades] = useState<GradesBySubject[]>([]);
  const [studentActivity, setStudentActivity] = useState<StudentActivity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setCurrentClassroomId] = useState(initialClassroomId);

  const loadStudents = useCallback(async (classroomId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherApi.getStudents(classroomId);
      setStudents(data);
      setCurrentClassroomId(classroomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectStudent = useCallback(async (id: string | null) => {
    if (id === null) {
      setSelectedStudent(null);
      setStudentGrades([]);
      setStudentActivity(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherApi.getStudent(id);
      setSelectedStudent(data.student);
      setStudentGrades(data.gradesBySubject);
      setStudentActivity(data.activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshStudent = useCallback(async () => {
    if (selectedStudent) {
      await selectStudent(selectedStudent.id);
    }
  }, [selectedStudent, selectStudent]);

  const createStudent = useCallback(async (data: CreateStudentRequest) => {
    const student = await teacherApi.createStudent(data);
    setStudents((prev) => [...prev, student]);
    return student;
  }, []);

  const updateStudent = useCallback(async (id: string, data: Partial<CreateStudentRequest>) => {
    const student = await teacherApi.updateStudent(id, data);
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...student } : s)));
    if (selectedStudent?.id === id) {
      setSelectedStudent((prev) => (prev ? { ...prev, ...student } : prev));
    }
    return student;
  }, [selectedStudent]);

  const deleteStudent = useCallback(async (id: string) => {
    await teacherApi.deleteStudent(id);
    setStudents((prev) => prev.filter((s) => s.id !== id));
    if (selectedStudent?.id === id) {
      setSelectedStudent(null);
      setStudentGrades([]);
      setStudentActivity(null);
    }
  }, [selectedStudent]);

  const addGrade = useCallback(async (studentId: string, data: Omit<AddGradeRequest, 'studentId'>) => {
    const grade = await teacherApi.addGrade(studentId, data);
    // Refresh student data if it's the selected student
    if (selectedStudent?.id === studentId) {
      await selectStudent(studentId);
    }
    return grade;
  }, [selectedStudent, selectStudent]);

  // Load students on mount if classroomId provided
  useEffect(() => {
    if (initialClassroomId) {
      loadStudents(initialClassroomId);
    }
  }, [initialClassroomId, loadStudents]);

  return {
    students,
    selectedStudent,
    studentGrades,
    studentActivity,
    isLoading,
    error,
    loadStudents,
    selectStudent,
    createStudent,
    updateStudent,
    deleteStudent,
    addGrade,
    refreshStudent,
  };
}
