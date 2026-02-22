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

/**
 * Structured homework question - used for JSON storage and form rendering
 */
export interface HomeworkQuestionJson {
  id: number;
  text: string;
  type: 'open' | 'choice';
  options?: string[];  // For choice type questions
}

/**
 * Structured homework content returned by AI
 */
export interface HomeworkContentJson {
  title: string;
  instructions?: string;
  questions: HomeworkQuestionJson[];
}

export interface HomeworkAssignment {
  id: string;
  teacherId: string;
  title: string;
  topic: string;
  subject?: string;
  masterContent: string;
  questionsJson?: HomeworkQuestionJson[];  // Structured questions array
  dueDate?: string;
  classroomId?: string;  // Target classroom (null = all students)
  assignedAt?: string;   // When questions were locked (assigned to students)
  sourceLessonId?: string; // Linked lesson for context-grounded generation
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkWithTeacher extends HomeworkAssignment {
  teacherName: string;
  personalizedCount?: number;
  classroomName?: string;  // Name of target classroom
  assignedAt?: string;     // When questions were locked (inherited from base)
}

export interface PersonalizedHomework {
  id: string;
  homeworkId: string;
  studentId: string;
  personalizedContent: string;
  questionsJson?: HomeworkQuestionJson[];  // Inherited from master or personalized
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
    questionsJson?: HomeworkQuestionJson[];  // Master questions (fallback)
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
  questionsJson?: HomeworkQuestionJson[];  // Structured questions (optional on create)
  sourceLessonId?: string; // Linked lesson for context-grounded generation
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
    content: string;        // personalizedContent (may equal masterContent if not yet personalized)
    masterContent?: string; // Teacher's original content (always available)
  };
}

// ============================================
// HOMEWORK CHAT TYPES (Socratic Sidekick)
// ============================================

export interface HomeworkChatSession {
  id: string;
  personalizedHomeworkId: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  questionContext?: string;  // Which question was asked about
  timestamp: string;
}

export interface HomeworkChatSessionWithDetails extends HomeworkChatSession {
  homeworkTitle: string;
  homeworkTopic: string;
  homeworkSubject?: string;
  messageCount: number;
}

export interface HomeworkChatResponse {
  session: HomeworkChatSession;
  messages: HomeworkChatMessage[];
  homework: {
    id: string;
    title: string;
    topic: string;
    subject?: string;
    questions: HomeworkQuestionJson[];
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

/**
 * Rubric-based grading breakdown.
 * Final grade = accuracy * 0.40 + reasoning * 0.40 + effort * 0.20
 */
export interface RubricScores {
  accuracy: number;   // 0-100: correctness of final answers
  reasoning: number;  // 0-100: logical steps / process shown
  effort: number;     // 0-100: depth of engagement, all problems attempted
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
  rubricScores?: RubricScores;
  gradedBy?: string;
  gradedAt?: string;
}

// ============================================
// EXIT TICKET TYPES (Comprehension Verification)
// ============================================

export interface ExitTicketQuestion {
  id: number;
  question: string;
}

export interface ExitTicketResult {
  passed: boolean;
  comprehensionScore: number;  // 0-1
  feedback: string;
  questionsCorrect: number;
  questionsTotal: number;
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
