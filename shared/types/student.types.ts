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
  classroomId?: string | null;  // null = remove from classroom
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

// 360-Degree Student Stats (for Student Oversight System)
export interface RecentLessonChat {
  id: string;
  lessonTitle: string;
  lessonTopic: string;
  subject: string | null;
  messageCount: number;
  lastActivity: string;
}

export interface RecentHomework {
  id: string;
  title: string;
  topic: string;
  subject: string | null;
  status: 'pending' | 'submitted' | 'graded';
  grade: number | null;
  submittedAt: string | null;
  dueDate: string | null;
}

export interface StudentStats {
  // Chat Activity
  chatHistoryCount: number;
  lessonChatsCompleted: number;
  lastChatDate: string | null;

  // Homework Status
  homeworkAssigned: number;
  homeworkSubmitted: number;
  homeworkPending: number;
  homeworkGraded: number;
  averageGrade: number | null;

  // Session List (for drill-down)
  recentSessions: RecentLessonChat[];

  // Homework Details
  recentHomework: RecentHomework[];
}

// Activity Summary for Grid View (Activity Pulse)
export interface ActivitySummary {
  studentId: string;
  lastActivity: string | null;
  pendingHomework: number;
  totalChatMessages: number;
}
