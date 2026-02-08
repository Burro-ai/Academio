// Student Profile Types (for Teacher Interface)

export interface Student {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  gradeLevel?: string;
  classroomId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentWithDetails extends Student {
  classroom?: {
    id: string;
    name: string;
    subject?: string;
  };
  currentStruggleScore?: number;
  recentGrades?: StudentGrade[];
  totalSessions?: number;
  // Profile-specific fields from unified system
  age?: number;
  favoriteSports?: string[];
  skillsToImprove?: string[];
  learningSystemPrompt?: string;
  teacherId?: string;
}

export type Subject = 'math' | 'science' | 'history' | 'geography' | 'english' | 'writing' | 'general';

export type AssignmentType = 'homework' | 'test' | 'quiz' | 'project' | 'participation';

export interface StudentGrade {
  id: string;
  studentId: string;
  subject: Subject;
  grade: number;
  maxGrade: number;
  assignmentName?: string;
  assignmentType?: AssignmentType;
  gradedAt: string;
}

export interface GradesBySubject {
  subject: Subject;
  grades: StudentGrade[];
  average: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface LearningAnalytics {
  id: string;
  studentId: string;
  sessionId: string;
  subject?: string;
  topic?: string;
  questionsAsked: number;
  timeSpentSeconds: number;
  struggleScore: number; // 0-1 scale
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentActivity {
  recentSessions: {
    id: string;
    topic: string;
    questionsAsked: number;
    struggleScore: number;
    createdAt: string;
  }[];
  totalQuestionsThisWeek: number;
  averageStruggleScore: number;
  topicsStudied: string[];
  needsIntervention: boolean;
}

export interface CreateStudentRequest {
  name: string;
  email?: string;
  gradeLevel?: string;
  classroomId?: string;
}

export interface UpdateStudentRequest {
  name?: string;
  email?: string;
  avatarUrl?: string;
  gradeLevel?: string;
  classroomId?: string;
}

export interface AddGradeRequest {
  studentId: string;
  subject: Subject;
  grade: number;
  maxGrade?: number;
  assignmentName?: string;
  assignmentType?: AssignmentType;
}

// Intervention Alert
export interface InterventionAlert {
  studentId: string;
  studentName: string;
  reason: string;
  struggleScore: number;
  subject?: string;
  topic?: string;
  recommendedAction: string;
  createdAt: string;
}
