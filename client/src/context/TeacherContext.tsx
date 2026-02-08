import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  Teacher,
  Classroom,
  Student,
  StudentProfileWithUser,
  StudentWithDetails,
  GradesBySubject,
  StudentActivity,
  InterventionAlert,
  TeacherChatSession,
  TeacherChatMessage,
  MaterialType,
  ClassroomStats,
} from '@/types';
import { teacherApi } from '@/services/teacherApi';

interface TeacherContextValue {
  // Auth
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;

  // Teacher
  teacher: Teacher | null;

  // Classrooms
  classrooms: Classroom[];
  selectedClassroom: Classroom | null;
  loadClassrooms: () => Promise<void>;
  selectClassroom: (id: string | null) => void;
  createClassroom: (name: string, subject?: string, gradeLevel?: string) => Promise<Classroom>;

  // Students
  students: (Student | StudentProfileWithUser)[];
  selectedStudent: StudentWithDetails | null;
  studentGrades: GradesBySubject[];
  studentActivity: StudentActivity | null;
  loadStudents: (classroomId?: string) => Promise<void>;
  selectStudent: (id: string | null) => Promise<void>;

  // Intervention Alerts
  interventionAlerts: InterventionAlert[];
  loadInterventionAlerts: () => Promise<void>;

  // Classroom Stats
  classroomStats: ClassroomStats | null;
  totalStats: {
    totalStudents: number;
    studentsStruggling: number;
    studentsExcelling: number;
    recentActivity: number;
  };

  // Chat Sessions
  chatSessions: TeacherChatSession[];
  currentChatSession: (TeacherChatSession & { messages: TeacherChatMessage[] }) | null;
  loadChatSessions: () => Promise<void>;
  createChatSession: (title?: string, materialType?: MaterialType) => Promise<TeacherChatSession>;
  selectChatSession: (id: string) => Promise<void>;
  deleteChatSession: (id: string) => Promise<void>;
  addChatMessage: (message: TeacherChatMessage) => void;
}

const TeacherContext = createContext<TeacherContextValue | null>(null);

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Teacher state
  const [teacher, setTeacher] = useState<Teacher | null>(null);

  // Classroom state
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);

  // Student state
  const [students, setStudents] = useState<(Student | StudentProfileWithUser)[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [studentGrades, setStudentGrades] = useState<GradesBySubject[]>([]);
  const [studentActivity, setStudentActivity] = useState<StudentActivity | null>(null);

  // Alerts & Stats
  const [interventionAlerts, setInterventionAlerts] = useState<InterventionAlert[]>([]);
  const [classroomStats, setClassroomStats] = useState<ClassroomStats | null>(null);
  const [totalStats, setTotalStats] = useState({
    totalStudents: 0,
    studentsStruggling: 0,
    studentsExcelling: 0,
    recentActivity: 0,
  });

  // Chat state
  const [chatSessions, setChatSessions] = useState<TeacherChatSession[]>([]);
  const [currentChatSession, setCurrentChatSession] = useState<
    (TeacherChatSession & { messages: TeacherChatMessage[] }) | null
  >(null);

  // Check for existing auth on mount
  useEffect(() => {
    const savedPassword = sessionStorage.getItem('teacherPassword');
    if (savedPassword) {
      teacherApi.setPassword(savedPassword);
      setIsAuthenticated(true);
      // Load initial data
      loadInitialData();
    }
    setIsLoading(false);
  }, []);

  const loadInitialData = async () => {
    try {
      const [profile, classroomData] = await Promise.all([
        teacherApi.getProfile(),
        teacherApi.getClassroomOverview(),
      ]);
      setTeacher(profile);
      if (classroomData.classrooms) {
        setClassrooms(classroomData.classrooms);
      }
      setTotalStats({
        totalStudents: classroomData.totalStudents,
        studentsStruggling: classroomData.studentsStruggling,
        studentsExcelling: classroomData.studentsExcelling || 0,
        recentActivity: classroomData.recentActivity || 0,
      });
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  // Auth methods
  const login = useCallback(async (password: string) => {
    const success = await teacherApi.verify(password);
    if (success) {
      sessionStorage.setItem('teacherPassword', password);
      setIsAuthenticated(true);
      await loadInitialData();
    }
    return success;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('teacherPassword');
    teacherApi.clearPassword();
    setIsAuthenticated(false);
    setTeacher(null);
    setClassrooms([]);
    setStudents([]);
    setChatSessions([]);
  }, []);

  // Classroom methods
  const loadClassrooms = useCallback(async () => {
    try {
      const data = await teacherApi.getClassrooms();
      setClassrooms(data);
    } catch (error) {
      console.error('Failed to load classrooms:', error);
    }
  }, []);

  const selectClassroom = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedClassroom(null);
      setClassroomStats(null);
    } else {
      const classroom = classrooms.find((c) => c.id === id);
      setSelectedClassroom(classroom || null);
    }
  }, [classrooms]);

  const createClassroom = useCallback(async (name: string, subject?: string, gradeLevel?: string) => {
    const classroom = await teacherApi.createClassroom({ name, subject, gradeLevel });
    setClassrooms((prev) => [...prev, classroom]);
    return classroom;
  }, []);

  // Student methods
  const loadStudents = useCallback(async (classroomId?: string) => {
    try {
      const data = await teacherApi.getStudents(classroomId);
      setStudents(data);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  }, []);

  const selectStudent = useCallback(async (id: string | null) => {
    if (id === null) {
      setSelectedStudent(null);
      setStudentGrades([]);
      setStudentActivity(null);
      return;
    }

    try {
      const data = await teacherApi.getStudent(id);
      setSelectedStudent(data.student);
      setStudentGrades(data.gradesBySubject);
      setStudentActivity(data.activity);
    } catch (error) {
      console.error('Failed to load student:', error);
    }
  }, []);

  // Alerts
  const loadInterventionAlerts = useCallback(async () => {
    try {
      const alerts = await teacherApi.getStrugglingStudents();
      setInterventionAlerts(alerts);
    } catch (error) {
      console.error('Failed to load intervention alerts:', error);
    }
  }, []);

  // Chat methods
  const loadChatSessions = useCallback(async () => {
    try {
      const sessions = await teacherApi.getChatSessions();
      setChatSessions(sessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  }, []);

  const createChatSession = useCallback(async (title?: string, materialType?: MaterialType) => {
    const session = await teacherApi.createChatSession({ title, materialType });
    setChatSessions((prev) => [session, ...prev]);
    setCurrentChatSession({ ...session, messages: [] });
    return session;
  }, []);

  const selectChatSession = useCallback(async (id: string) => {
    try {
      const session = await teacherApi.getChatSession(id);
      setCurrentChatSession(session);
    } catch (error) {
      console.error('Failed to load chat session:', error);
    }
  }, []);

  const deleteChatSession = useCallback(
    async (id: string) => {
      await teacherApi.deleteChatSession(id);
      setChatSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentChatSession?.id === id) {
        setCurrentChatSession(null);
      }
    },
    [currentChatSession]
  );

  const addChatMessage = useCallback((message: TeacherChatMessage) => {
    setCurrentChatSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, message],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  return (
    <TeacherContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        teacher,
        classrooms,
        selectedClassroom,
        loadClassrooms,
        selectClassroom,
        createClassroom,
        students,
        selectedStudent,
        studentGrades,
        studentActivity,
        loadStudents,
        selectStudent,
        interventionAlerts,
        loadInterventionAlerts,
        classroomStats,
        totalStats,
        chatSessions,
        currentChatSession,
        loadChatSessions,
        createChatSession,
        selectChatSession,
        deleteChatSession,
        addChatMessage,
      }}
    >
      {children}
    </TeacherContext.Provider>
  );
}

export function useTeacherContext() {
  const context = useContext(TeacherContext);
  if (!context) {
    throw new Error('useTeacherContext must be used within a TeacherProvider');
  }
  return context;
}
