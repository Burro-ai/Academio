import { Request } from 'express';
import { Teacher } from '../../../shared/types';

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
