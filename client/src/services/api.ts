import { Session, CreateSessionRequest, Topic } from '@/types';
import { authenticatedFetch } from './authInterceptor';

const API_BASE = '/api';

class ApiService {
  /**
   * Make authenticated API request using the global interceptor
   * The interceptor handles:
   * - Token injection
   * - 401 handling with auto-logout
   * - Content-Type headers
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await authenticatedFetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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

  // File upload - uses FormData, interceptor handles auth
  async uploadFile(file: File): Promise<{
    id: string;
    filename: string;
    type: 'pdf' | 'image';
    extractedText?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    // Don't set Content-Type for FormData (browser sets boundary)
    const response = await authenticatedFetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
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
