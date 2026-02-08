import { authApi } from './authApi';
import {
  LessonWithTeacher,
  HomeworkWithTeacher,
  CreateLessonRequest,
  CreateHomeworkRequest,
  UpdateLessonRequest,
  UpdateHomeworkRequest,
} from '@/types';

const API_BASE = '/api';

/**
 * Decode JWT token to get payload (without verification)
 */
function decodeToken(token: string): { id?: string; email?: string; role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

class LessonApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = authApi.getToken();

    if (!token) {
      throw new Error('Not authenticated. Please log in again.');
    }

    // Debug: Log what's in the token
    const decoded = decodeToken(token);
    console.log('[LessonAPI] Request to', endpoint, '- Token role:', decoded?.role, '- Email:', decoded?.email);

    if (decoded?.role !== 'TEACHER') {
      console.error('[LessonAPI] WARNING: Token does not have TEACHER role!', decoded);
      throw new Error(`Access denied. Current role is "${decoded?.role}" but TEACHER is required. Please log out and log in again as a teacher.`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));

      // Handle specific auth errors
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      if (response.status === 403) {
        console.error('[LessonAPI] 403 Forbidden - Token payload:', decoded);
        throw new Error('Access denied. You need teacher permissions for this action. Please log out and log in again as a teacher.');
      }

      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============ LESSONS ============

  /**
   * Get all lessons for current teacher
   */
  async getLessons(): Promise<LessonWithTeacher[]> {
    return this.request('/lessons');
  }

  /**
   * Get lesson by ID
   */
  async getLesson(id: string): Promise<LessonWithTeacher> {
    return this.request(`/lessons/${id}`);
  }

  /**
   * Create a new lesson
   */
  async createLesson(data: CreateLessonRequest): Promise<LessonWithTeacher> {
    return this.request('/lessons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a lesson
   */
  async updateLesson(id: string, data: UpdateLessonRequest): Promise<LessonWithTeacher> {
    return this.request(`/lessons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a lesson
   */
  async deleteLesson(id: string): Promise<void> {
    await this.request(`/lessons/${id}`, { method: 'DELETE' });
  }

  /**
   * Personalize lesson for all students
   */
  async personalizeLesson(id: string): Promise<{ count: number }> {
    return this.request(`/lessons/${id}/personalize`, { method: 'POST' });
  }

  /**
   * Generate master content using AI (non-streaming)
   */
  async generateLessonContent(topic: string, subject?: string): Promise<{ content: string }> {
    return this.request('/lessons/generate-content', {
      method: 'POST',
      body: JSON.stringify({ topic, subject }),
    });
  }

  /**
   * Generate master content using AI (streaming)
   * Returns an async generator that yields text chunks
   */
  async *streamLessonContent(
    topic: string,
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const token = authApi.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in again.');
    }

    const params = new URLSearchParams({ topic });
    if (subject) params.append('subject', subject);

    const response = await fetch(`${API_BASE}/lessons/generate-content/stream?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to start stream: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data) {
              try {
                const parsed = JSON.parse(data);
                yield parsed;
                if (parsed.done) return;
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get personalization progress for a lesson
   */
  async getLessonProgress(id: string): Promise<{
    lessonId: string;
    status: 'idle' | 'pending' | 'in_progress' | 'completed' | 'error';
    total: number;
    completed: number;
    current: string | null;
    error?: string;
  }> {
    return this.request(`/lessons/${id}/progress`);
  }

  // ============ HOMEWORK ============

  /**
   * Get all homework for current teacher
   */
  async getHomework(): Promise<HomeworkWithTeacher[]> {
    return this.request('/homework');
  }

  /**
   * Get homework by ID
   */
  async getHomeworkById(id: string): Promise<HomeworkWithTeacher> {
    return this.request(`/homework/${id}`);
  }

  /**
   * Create new homework
   */
  async createHomework(data: CreateHomeworkRequest): Promise<HomeworkWithTeacher> {
    return this.request('/homework', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update homework
   */
  async updateHomework(id: string, data: UpdateHomeworkRequest): Promise<HomeworkWithTeacher> {
    return this.request(`/homework/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete homework
   */
  async deleteHomework(id: string): Promise<void> {
    await this.request(`/homework/${id}`, { method: 'DELETE' });
  }

  /**
   * Personalize homework for all students
   */
  async personalizeHomework(id: string): Promise<{ count: number }> {
    return this.request(`/homework/${id}/personalize`, { method: 'POST' });
  }

  /**
   * Generate master content using AI (non-streaming)
   */
  async generateHomeworkContent(topic: string, subject?: string): Promise<{ content: string }> {
    return this.request('/homework/generate-content', {
      method: 'POST',
      body: JSON.stringify({ topic, subject }),
    });
  }

  /**
   * Generate homework content using AI (streaming)
   * Returns an async generator that yields text chunks
   */
  async *streamHomeworkContent(
    topic: string,
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const token = authApi.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in again.');
    }

    const params = new URLSearchParams({ topic });
    if (subject) params.append('subject', subject);

    const response = await fetch(`${API_BASE}/homework/generate-content/stream?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to start stream: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data) {
              try {
                const parsed = JSON.parse(data);
                yield parsed;
                if (parsed.done) return;
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get personalization progress for homework
   */
  async getHomeworkProgress(id: string): Promise<{
    homeworkId: string;
    status: 'idle' | 'pending' | 'in_progress' | 'completed' | 'error';
    total: number;
    completed: number;
    current: string | null;
    error?: string;
  }> {
    return this.request(`/homework/${id}/progress`);
  }
}

export const lessonApi = new LessonApiService();
