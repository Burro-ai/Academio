// Lesson and Homework Types (AI Customization Loop)

export interface Lesson {
  id: string;
  teacherId: string;
  title: string;
  topic: string;
  subject?: string;
  masterContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonWithTeacher extends Lesson {
  teacherName: string;
  personalizedCount?: number;
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
  generateForStudents?: boolean; // Auto-personalize for all students
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
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkWithTeacher extends HomeworkAssignment {
  teacherName: string;
  personalizedCount?: number;
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
  generateForStudents?: boolean;
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
