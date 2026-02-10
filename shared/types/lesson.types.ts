// Lesson and Homework Types (AI Customization Loop)

export interface Lesson {
  id: string;
  teacherId: string;
  title: string;
  topic: string;
  subject?: string;
  masterContent: string;
  classroomId?: string;  // Target classroom (null = all students)
  createdAt: string;
  updatedAt: string;
}

export interface LessonWithTeacher extends Lesson {
  teacherName: string;
  personalizedCount?: number;
  classroomName?: string;  // Name of target classroom
}

export interface PersonalizedLesson {
  id: string;
  lessonId: string;
  studentId: string;
  personalizedContent: string;
  viewedAt?: string;
  createdAt: string;
}

export interface PersonalizedLessonWithDetails extends PersonalizedLesson {
  lesson: {
    title: string;
    topic: string;
    subject?: string;
    teacherName: string;
  };
}

export interface CreateLessonRequest {
  title: string;
  topic: string;
  subject?: string;
  masterContent?: string; // If not provided, AI generates it
  classroomId?: string;   // Target classroom (null = all students)
  generateForStudents?: boolean; // Auto-personalize for students in classroom
}

export interface UpdateLessonRequest {
  title?: string;
  topic?: string;
  subject?: string;
  masterContent?: string;
}

// Homework Types

export interface HomeworkAssignment {
  id: string;
  teacherId: string;
  title: string;
  topic: string;
  subject?: string;
  masterContent: string;
  dueDate?: string;
  classroomId?: string;  // Target classroom (null = all students)
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkWithTeacher extends HomeworkAssignment {
  teacherName: string;
  personalizedCount?: number;
  classroomName?: string;  // Name of target classroom
}

export interface PersonalizedHomework {
  id: string;
  homeworkId: string;
  studentId: string;
  personalizedContent: string;
  submittedAt?: string;
  createdAt: string;
}

export interface PersonalizedHomeworkWithDetails extends PersonalizedHomework {
  homework: {
    title: string;
    topic: string;
    subject?: string;
    dueDate?: string;
    teacherName: string;
  };
}

export interface CreateHomeworkRequest {
  title: string;
  topic: string;
  subject?: string;
  masterContent?: string;
  dueDate?: string;
  classroomId?: string;   // Target classroom (null = all students)
  generateForStudents?: boolean; // Auto-personalize for students in classroom
}

export interface UpdateHomeworkRequest {
  title?: string;
  topic?: string;
  subject?: string;
  masterContent?: string;
  dueDate?: string;
}

// AI Generation Types

export interface GenerateMasterContentRequest {
  topic: string;
  subject?: string;
  type: 'lesson' | 'homework';
  gradeLevel?: string;
}

export interface PersonalizeContentRequest {
  contentId: string;
  type: 'lesson' | 'homework';
  studentIds?: string[]; // If not provided, personalize for all students
}

// ============================================
// LESSON CHAT TYPES (Interactive AI Tutoring)
// ============================================

export interface LessonChatSession {
  id: string;
  personalizedLessonId: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface LessonChatSessionWithDetails extends LessonChatSession {
  lessonTitle: string;
  lessonTopic: string;
  lessonSubject?: string;
  messageCount: number;
}

export interface LessonChatResponse {
  session: LessonChatSession;
  messages: LessonChatMessage[];
  lesson: {
    id: string;
    title: string;
    topic: string;
    subject?: string;
    content: string;
  };
}

// ============================================
// HOMEWORK SUBMISSION TYPES (Structured Form)
// ============================================

export interface HomeworkQuestion {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'number';
  order: number;
}

export interface HomeworkAnswer {
  questionId: string;
  value: string;
}

export interface HomeworkSubmission {
  id: string;
  personalizedHomeworkId: string;
  studentId: string;
  answers: HomeworkAnswer[];
  submittedAt: string;
  grade?: number;
  feedback?: string;
  aiSuggestedGrade?: number;
  aiSuggestedFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
}

export interface HomeworkSubmissionWithDetails extends HomeworkSubmission {
  homeworkTitle: string;
  homeworkTopic: string;
  homeworkSubject?: string;
  studentName: string;
  studentEmail: string;
  personalizedContent: string;
}

export interface SubmitHomeworkRequest {
  answers: HomeworkAnswer[];
}

export interface GradeSubmissionRequest {
  grade: number;
  feedback: string;
}

export interface SubmissionStats {
  total: number;
  graded: number;
}
