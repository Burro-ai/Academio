import { Request } from 'express';
import { Teacher, User, JwtPayload } from '../../../shared/types';

// Re-export shared types
export * from '../../../shared/types';

// Server-specific types
export interface AuthenticatedRequest extends Request {
  isAdmin?: boolean;
}

export interface TeacherAuthenticatedRequest extends Request {
  teacher?: Teacher;
  isTeacher?: boolean;
}

// JWT-authenticated request (unified auth)
export interface JwtAuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Database row types (snake_case)
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'STUDENT' | 'TEACHER';
  name: string;
  avatar_url: string | null;
  school_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolRow {
  id: string;
  name: string;
  domain: string | null;
  settings: string;                 // JSON string
  subscription_tier: string;
  max_students: number;
  max_teachers: number;
  is_active: number;                // SQLite boolean as integer
  created_at: string;
  updated_at: string;
}

export interface SchoolMembershipRow {
  id: string;
  user_id: string;
  school_id: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  is_primary: number;               // SQLite boolean as integer
  permissions: string;              // JSON string
  joined_at: string;
}

export interface StudentProfileRow {
  id: string;
  user_id: string;
  age: number | null;
  favorite_sports: string | null; // JSON string
  skills_to_improve: string | null; // JSON string
  grade_history: string | null; // JSON string
  learning_system_prompt: string | null;
  grade_level: string | null;
  classroom_id: string | null;
  teacher_id: string | null;    // Primary teacher (backwards compatible)
  teacher_ids: string | null;   // JSON array of teacher IDs
  school_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  teacher_id: string;
  title: string;
  topic: string;
  subject: string | null;
  master_content: string;
  classroom_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonalizedLessonRow {
  id: string;
  lesson_id: string;
  student_id: string;
  personalized_content: string;
  viewed_at: string | null;
  created_at: string;
}

export interface HomeworkRow {
  id: string;
  teacher_id: string;
  title: string;
  topic: string;
  subject: string | null;
  master_content: string;
  questions_json: string | null;  // JSON array of structured questions
  due_date: string | null;
  classroom_id: string | null;
  assigned_at: string | null;     // When questions were locked
  source_lesson_id: string | null; // Linked lesson for context-grounded generation
  created_at: string;
  updated_at: string;
}

export interface PersonalizedHomeworkRow {
  id: string;
  homework_id: string;
  student_id: string;
  personalized_content: string;
  questions_json: string | null;  // JSON array (inherits from master)
  submitted_at: string | null;
  created_at: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  context?: number[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface FileUploadResult {
  id: string;
  filename: string;
  type: 'pdf' | 'image';
  extractedText?: string;
  path: string;
}
