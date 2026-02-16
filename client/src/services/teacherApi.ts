import {
  Teacher,
  Classroom,
  Student,
  StudentWithDetails,
  StudentProfileWithUser,
  GradesBySubject,
  StudentActivity,
  StudentGrade,
  StudentStats,
  ActivitySummary,
  AddGradeRequest,
  ClassroomStats,
  InterventionAlert,
  TeacherChatSession,
  TeacherChatMessage,
  MaterialType,
  CreateStudentRequest,
  UpdateStudentRequest,
  CreateClassroomRequest,
  Subject,
  HomeworkSubmission,
  HomeworkSubmissionWithDetails,
  LessonChatSession,
  LessonChatMessage,
  LessonChatSessionWithDetails,
} from '@/types';
import { authenticatedFetch, getAuthHeaders } from './authInterceptor';

const API_BASE = '/api';

class TeacherApiService {
  // Legacy password field - kept for backwards compatibility with old login flow
  // Now uses JWT auth via authenticatedFetch, but kept for potential fallback
  private _legacyPassword: string | null = null;

  /** @deprecated Use JWT auth instead. Legacy password auth. */
  setPassword(password: string) {
    this._legacyPassword = password;
  }

  /** @deprecated Use JWT auth instead. Clear legacy password. */
  clearPassword() {
    this._legacyPassword = null;
  }

  /** Check if legacy password is set (for backwards compatibility) */
  hasLegacyPassword(): boolean {
    return this._legacyPassword !== null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Use authenticated fetch - interceptor handles token injection
    const response = await authenticatedFetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============ Authentication ============

  async verify(password: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/teacher/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        this._legacyPassword = password;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ============ Teacher Profile ============

  async getProfile(): Promise<Teacher> {
    return this.request<Teacher>('/teacher/profile');
  }

  // ============ Classrooms ============

  async getClassrooms(): Promise<Classroom[]> {
    return this.request<Classroom[]>('/teacher/classrooms');
  }

  async createClassroom(data: CreateClassroomRequest): Promise<Classroom> {
    return this.request<Classroom>('/teacher/classrooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClassroom(id: string, data: Partial<CreateClassroomRequest>): Promise<Classroom> {
    return this.request<Classroom>(`/teacher/classrooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteClassroom(id: string): Promise<void> {
    await this.request(`/teacher/classrooms/${id}`, { method: 'DELETE' });
  }

  // ============ Students ============

  async getStudents(classroomId?: string): Promise<(Student | StudentProfileWithUser)[]> {
    const query = classroomId ? `?classroomId=${classroomId}` : '';
    return this.request<(Student | StudentProfileWithUser)[]>(`/students${query}`);
  }

  async getStudent(id: string): Promise<{
    student: StudentWithDetails;
    gradesBySubject: GradesBySubject[];
    activity: StudentActivity;
  }> {
    return this.request(`/students/${id}`);
  }

  async createStudent(data: CreateStudentRequest): Promise<Student> {
    return this.request<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: string, data: UpdateStudentRequest): Promise<Student> {
    return this.request<Student>(`/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteStudent(id: string): Promise<void> {
    await this.request(`/students/${id}`, { method: 'DELETE' });
  }

  // ============ Grades ============

  async getStudentGrades(studentId: string, subject?: Subject): Promise<GradesBySubject[] | StudentGrade[]> {
    const query = subject ? `?subject=${subject}` : '';
    return this.request(`/students/${studentId}/grades${query}`);
  }

  async addGrade(studentId: string, data: Omit<AddGradeRequest, 'studentId'>): Promise<StudentGrade> {
    return this.request<StudentGrade>(`/students/${studentId}/grades`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ Activity & Intervention ============

  async getStudentActivity(studentId: string): Promise<StudentActivity> {
    return this.request<StudentActivity>(`/students/${studentId}/activity`);
  }

  async getStudentIntervention(studentId: string): Promise<{
    needsIntervention: boolean;
    recommendation: string | null;
  }> {
    return this.request(`/students/${studentId}/intervention`);
  }

  // ============ Classroom Analytics ============

  async getClassroomOverview(classroomId?: string): Promise<{
    classrooms?: (Classroom & { stats: ClassroomStats })[];
    classroom?: Classroom;
    stats?: ClassroomStats;
    totalStudents: number;
    studentsStruggling: number;
    studentsExcelling?: number;
    recentActivity?: number;
  }> {
    const query = classroomId ? `?classroomId=${classroomId}` : '';
    return this.request(`/classroom${query}`);
  }

  async getStrugglingStudents(): Promise<InterventionAlert[]> {
    return this.request<InterventionAlert[]>('/classroom/struggling');
  }

  async getSubjectAverage(classroomId: string, subject: Subject): Promise<{
    classroomId: string;
    subject: Subject;
    average: number;
  }> {
    return this.request(`/classroom/${classroomId}/subject/${subject}/average`);
  }

  // ============ Teacher Chat (AI Assistant) ============

  async getChatSessions(): Promise<TeacherChatSession[]> {
    return this.request<TeacherChatSession[]>('/teacher/chat/sessions');
  }

  async getChatSession(id: string): Promise<TeacherChatSession & { messages: TeacherChatMessage[] }> {
    return this.request(`/teacher/chat/sessions/${id}`);
  }

  async createChatSession(data: {
    title?: string;
    materialType?: MaterialType;
  }): Promise<TeacherChatSession> {
    return this.request<TeacherChatSession>('/teacher/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChatSession(id: string, data: {
    title?: string;
    materialType?: MaterialType;
  }): Promise<TeacherChatSession> {
    return this.request<TeacherChatSession>(`/teacher/chat/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteChatSession(id: string): Promise<void> {
    await this.request(`/teacher/chat/sessions/${id}`, { method: 'DELETE' });
  }

  // Get stream URL for SSE (used with authenticatedFetch)
  getStreamUrl(sessionId: string, message: string, materialType?: MaterialType): string {
    const params = new URLSearchParams({
      sessionId,
      message,
    });
    if (materialType) {
      params.append('materialType', materialType);
    }
    return `${API_BASE}/teacher/chat/stream?${params}`;
  }

  // Get auth headers for SSE streams (for components that manage their own streaming)
  getStreamHeaders(): Record<string, string> {
    return getAuthHeaders();
  }

  // ============ Homework Submissions (Grading) ============

  async getPendingSubmissions(): Promise<HomeworkSubmissionWithDetails[]> {
    return this.request<HomeworkSubmissionWithDetails[]>('/teacher/homework/pending');
  }

  async getHomeworkSubmissions(homeworkId: string): Promise<{
    submissions: HomeworkSubmissionWithDetails[];
    stats: { total: number; graded: number };
  }> {
    return this.request(`/teacher/homework/${homeworkId}/submissions`);
  }

  async getSubmission(submissionId: string): Promise<HomeworkSubmission> {
    return this.request(`/teacher/homework/submissions/${submissionId}`);
  }

  async gradeSubmission(
    submissionId: string,
    grade: number,
    feedback: string
  ): Promise<{ message: string; submission: HomeworkSubmission }> {
    return this.request(`/teacher/homework/submissions/${submissionId}/grade`, {
      method: 'PUT',
      body: JSON.stringify({ grade, feedback }),
    });
  }

  async regenerateAISuggestion(submissionId: string): Promise<{
    aiSuggestedGrade: number;
    aiSuggestedFeedback: string;
  }> {
    return this.request(`/teacher/homework/submissions/${submissionId}/regenerate-ai`, {
      method: 'POST',
    });
  }

  // ============ Student Stats (360-Degree View) ============

  async getStudentStats(studentId: string): Promise<StudentStats> {
    return this.request<StudentStats>(`/teacher/students/${studentId}/stats`);
  }

  async getStudentsActivitySummary(): Promise<ActivitySummary[]> {
    return this.request<ActivitySummary[]>('/teacher/students/activity-summary');
  }

  // ============ Student Lesson Chats (Oversight) ============

  async getStudentLessonChats(studentId: string): Promise<LessonChatSessionWithDetails[]> {
    return this.request<LessonChatSessionWithDetails[]>(
      `/teacher/students/${studentId}/lesson-chats`
    );
  }

  async viewLessonChat(sessionId: string): Promise<{
    session: LessonChatSession;
    messages: LessonChatMessage[];
    lesson: {
      id: string;
      title: string;
      topic: string;
      subject?: string;
    } | null;
  }> {
    return this.request(`/teacher/lesson-chats/${sessionId}`);
  }
}

export const teacherApi = new TeacherApiService();
