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

class LessonApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = authApi.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
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
   * Generate master content using AI
   */
  async generateLessonContent(topic: string, subject?: string): Promise<{ content: string }> {
    return this.request('/lessons/generate-content', {
      method: 'POST',
      body: JSON.stringify({ topic, subject }),
    });
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
   * Generate master content using AI
   */
  async generateHomeworkContent(topic: string, subject?: string): Promise<{ content: string }> {
    return this.request('/homework/generate-content', {
      method: 'POST',
      body: JSON.stringify({ topic, subject }),
    });
  }
}

export const lessonApi = new LessonApiService();
