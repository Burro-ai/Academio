// Re-export shared types
export * from '../../../shared/types';

// Frontend-specific types
export interface StreamEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  messageId?: string;
  error?: string;
}

export interface ChatState {
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
}

export interface TopicOption {
  id: string;
  label: string;
  icon: string;
  color: string;
}

// Teacher Interface specific types
export interface TeacherStreamEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  messageId?: string;
  error?: string;
}

export interface MaterialTypeOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface SubjectOption {
  id: string;
  label: string;
  color: string;
}
