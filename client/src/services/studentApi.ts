import { authApi } from './authApi';
import {
  StudentProfile,
  UpdateStudentProfileRequest,
  PersonalizedLessonWithDetails,
  PersonalizedHomeworkWithDetails,
  User,
} from '@/types';

const API_BASE = '/api';

class StudentApiService {
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

  /**
   * Get student profile
   */
  async getProfile(): Promise<StudentProfile> {
    return this.request('/student/profile');
  }

  /**
   * Update student profile
   */
  async updateProfile(data: UpdateStudentProfileRequest): Promise<StudentProfile> {
    return this.request('/student/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get personalized lessons for current student
   */
  async getMyLessons(): Promise<PersonalizedLessonWithDetails[]> {
    return this.request('/student/lessons');
  }

  /**
   * Mark a lesson as viewed
   */
  async markLessonViewed(lessonId: string): Promise<void> {
    await this.request(`/student/lessons/${lessonId}/view`, {
      method: 'POST',
    });
  }

  /**
   * Get personalized homework for current student
   */
  async getMyHomework(): Promise<PersonalizedHomeworkWithDetails[]> {
    return this.request('/student/homework');
  }

  /**
   * Mark homework as submitted
   */
  async submitHomework(homeworkId: string): Promise<void> {
    await this.request(`/student/homework/${homeworkId}/submit`, {
      method: 'POST',
    });
  }

  /**
   * Get all available teachers
   */
  async getTeachers(): Promise<User[]> {
    return this.request('/student/teachers');
  }

  /**
   * Set the student's selected teacher (single - backwards compatible)
   */
  async setTeacher(teacherId: string | null): Promise<StudentProfile> {
    return this.request('/student/teacher', {
      method: 'PUT',
      body: JSON.stringify({ teacherId }),
    });
  }

  /**
   * Set the student's selected teachers (multiple)
   */
  async setTeachers(teacherIds: string[]): Promise<StudentProfile> {
    return this.request('/student/teachers', {
      method: 'PUT',
      body: JSON.stringify({ teacherIds }),
    });
  }
}

export const studentApi = new StudentApiService();
