import {
  LessonWithTeacher,
  HomeworkWithTeacher,
  CreateLessonRequest,
  CreateHomeworkRequest,
  UpdateLessonRequest,
  UpdateHomeworkRequest,
} from '@/types';
import {
  authenticatedFetch,
  getTokenSync,
  normalizeRole,
  forceLogout,
} from './authInterceptor';

const API_BASE = '/api';

/**
 * Decode base64url (JWT uses URL-safe base64, not standard base64)
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return atob(base64);
}

/**
 * Decode JWT token to get payload (without verification)
 */
function decodeToken(token: string): { id?: string; email?: string; role?: string; schoolId?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = base64UrlDecode(parts[1]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

class LessonApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = getTokenSync();

    if (!token) {
      throw new Error('Not authenticated. Please log in again.');
    }

    // Validate role before making request
    const decoded = decodeToken(token);
    const role = normalizeRole(decoded?.role);

    if (role !== 'TEACHER') {
      console.error('[LessonAPI] Role check failed:', decoded?.role);
      throw new Error(`Access denied. Current role is "${decoded?.role}" but TEACHER is required.`);
    }

    // Use authenticated fetch - interceptor handles token injection and 401s
    const response = await authenticatedFetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));

      // Handle specific auth errors
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      if (response.status === 403) {
        throw new Error('Access denied. You need teacher permissions for this action.');
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
   * Validate auth token for streaming - throws if invalid
   */
  private validateStreamAuth(): string {
    const token = getTokenSync();
    if (!token) {
      throw new Error('Not authenticated. Please log in again.');
    }

    const decoded = decodeToken(token);
    const role = normalizeRole(decoded?.role);

    if (role !== 'TEACHER') {
      console.error('[LessonAPI] Stream auth failed - Token role:', decoded?.role);
      throw new Error(`Access denied. You need teacher permissions. Current role: ${decoded?.role || 'none'}.`);
    }

    return token;
  }

  /**
   * Generate master content using AI (streaming)
   * Returns an async generator that yields text chunks
   */
  async *streamLessonContent(
    topic: string,
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    // Validate auth before starting stream
    this.validateStreamAuth();

    const params = new URLSearchParams({ topic });
    if (subject) params.append('subject', subject);

    console.log('[LessonAPI] Starting lesson content stream...');

    // Use authenticated fetch for SSE
    const response = await authenticatedFetch(`${API_BASE}/lessons/generate-content/stream?${params}`, {
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      let errorMsg = `Failed to start stream: ${response.status}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || parsed.message || errorMsg;
        }
      } catch {
        // Use default error message
      }

      if (response.status === 403) {
        throw new Error('Access denied. Please log out and log in again as a teacher.');
      }
      if (response.status === 401) {
        forceLogout('token_expired');
        throw new Error('Session expired. Please log in again.');
      }

      throw new Error(errorMsg);
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
    // Validate auth before starting stream
    this.validateStreamAuth();

    const params = new URLSearchParams({ topic });
    if (subject) params.append('subject', subject);

    console.log('[LessonAPI] Starting homework content stream...');

    // Use authenticated fetch for SSE
    const response = await authenticatedFetch(`${API_BASE}/homework/generate-content/stream?${params}`, {
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      let errorMsg = `Failed to start stream: ${response.status}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || parsed.message || errorMsg;
        }
      } catch {
        // Use default error message
      }

      if (response.status === 403) {
        throw new Error('Access denied. Please log out and log in again as a teacher.');
      }
      if (response.status === 401) {
        forceLogout('token_expired');
        throw new Error('Session expired. Please log in again.');
      }

      throw new Error(errorMsg);
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
