export type Topic = 'math' | 'science' | 'history' | 'writing' | 'general';

export interface Session {
  id: string;
  topic: Topic;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionRequest {
  topic: Topic;
  title?: string;
}

export interface UpdateSessionRequest {
  title?: string;
  topic?: Topic;
}
