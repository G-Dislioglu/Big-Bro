// API helper functions

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  time: string;
  db: {
    configured: boolean;
    ok?: boolean;
    error?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: any;
  updated_at: string;
}

class ApiClient {
  private adminKey: string | null = null;

  setAdminKey(key: string) {
    this.adminKey = key;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.adminKey) {
      headers['x-admin-key'] = this.adminKey;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch('/api/health');
    return response.json();
  }

  async checkAuth() {
    return this.fetchWithAuth('/api/auth/whoami');
  }

  async getTasks(): Promise<{ tasks: Task[] }> {
    return this.fetchWithAuth('/api/tasks');
  }

  async createTask(title: string, status = 'todo'): Promise<{ task: Task }> {
    return this.fetchWithAuth('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, status }),
    });
  }

  async updateTask(id: string, updates: { title?: string; status?: string }): Promise<{ task: Task }> {
    return this.fetchWithAuth('/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...updates }),
    });
  }

  async getSettings(): Promise<{ settings: Setting[] }> {
    return this.fetchWithAuth('/api/settings');
  }

  async updateSetting(key: string, value: any): Promise<{ setting: Setting }> {
    return this.fetchWithAuth('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  }
}

export const api = new ApiClient();
