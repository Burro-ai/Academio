import { Session, CreateSessionRequest, Topic } from '@/types';
import { authApi } from './authApi';

const API_BASE = '/api';

class ApiService {
  /**
   * Get auth headers if user is logged in
   */
  private getAuthHeaders(): Record<string, string> {
    const token = authApi.getToken();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Sessions
  async getSessions(): Promise<Session[]> {
    return this.request<Session[]>('/sessions');
  }

  async getSession(id: string): Promise<Session & { messages: any[] }> {
    return this.request(`/sessions/${id}`);
  }

  async createSession(topic: Topic, title?: string): Promise<Session> {
    return this.request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ topic, title } as CreateSessionRequest),
    });
  }

  async updateSession(id: string, data: { title?: string; topic?: Topic }): Promise<Session> {
    return this.request<Session>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(`/sessions/${id}`, { method: 'DELETE' });
  }

  // File upload
  async uploadFile(file: File): Promise<{
    id: string;
    filename: string;
    type: 'pdf' | 'image';
    extractedText?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  // Admin (requires auth)
  async adminVerify(password: string): Promise<boolean> {
    try {
      await this.request('/admin/verify', {
        headers: {
          Authorization: `Bearer ${password}`,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getSystemPrompt(password: string): Promise<{
    prompt: string;
    defaultPrompt: string;
    isDefault: boolean;
  }> {
    return this.request('/admin/prompt', {
      headers: {
        Authorization: `Bearer ${password}`,
      },
    });
  }

  async updateSystemPrompt(password: string, prompt: string): Promise<void> {
    await this.request('/admin/prompt', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify({ prompt }),
    });
  }

  async resetSystemPrompt(password: string): Promise<{ prompt: string }> {
    return this.request('/admin/prompt/reset', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${password}`,
      },
    });
  }

  // Health check
  async checkOllamaHealth(): Promise<{ ok: boolean; error?: string }> {
    return this.request('/chat/health');
  }
}

export const api = new ApiService();
