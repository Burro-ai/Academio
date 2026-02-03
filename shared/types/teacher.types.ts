// Teacher Interface Types

export interface Teacher {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Classroom {
  id: string;
  name: string;
  teacherId: string;
  subject?: string;
  gradeLevel?: string;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherLoginRequest {
  email: string;
  password: string;
}

export interface TeacherLoginResponse {
  teacher: Teacher;
  token: string;
}

export interface CreateClassroomRequest {
  name: string;
  subject?: string;
  gradeLevel?: string;
}

export interface UpdateClassroomRequest {
  name?: string;
  subject?: string;
  gradeLevel?: string;
}

// Teacher Chat (AI Assistant) Types
export type MaterialType = 'lesson' | 'presentation' | 'test' | 'homework' | 'general';

export interface TeacherChatSession {
  id: string;
  teacherId: string;
  title: string;
  materialType: MaterialType;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CreateTeacherChatSessionRequest {
  title?: string;
  materialType?: MaterialType;
}

export interface TeacherChatRequest {
  sessionId: string;
  message: string;
  materialType?: MaterialType;
}

export interface TeacherStreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  messageId?: string;
  error?: string;
}

// Classroom Overview Stats
export interface ClassroomStats {
  totalStudents: number;
  averageGrade: number;
  studentsStruggling: number;
  studentsExcelling: number;
  recentActivity: number; // Sessions in last 7 days
}
