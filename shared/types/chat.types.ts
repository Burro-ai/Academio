export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: 'pdf' | 'image';
  filename: string;
  extractedText?: string;
  url?: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  attachments?: Attachment[];
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  messageId?: string;
  error?: string;
}
