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

export interface Card {
  id: string;
  title: string;
  type: string;
  content: string;
  tags: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CardLink {
  id: string;
  from_card_id: string;
  to_card_id: string;
  link_type: string;
  strength: number;
  note: string;
  created_at: string;
  updated_at: string;
  to_card_title?: string;
  to_card_type?: string;
  from_card_title?: string;
  from_card_type?: string;
}

// PR-1: Idea Cards (new schema)
export interface IdeaCard {
  id: string;
  title: string;
  body: string;
  tags: string[];
  layer: 'Rational' | 'Spekulativ' | 'Meta';
  value_pct: number;
  status: 'draft' | 'tested' | 'validated' | 'killed';
  risk_notes: string;
  next_steps: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaCardLink {
  id: string;
  source_id: string;
  target_id: string;
  type: 'supports' | 'contradicts' | 'depends_on' | 'variant_of';
  weight: number;
  note: string;
  created_at: string;
}

export interface CrossingResult {
  suggestedCards: (Card & { score: number; reason: string })[];
  suggestedLinks: Omit<CardLink, 'id' | 'created_at' | 'updated_at'>[];
  mode: string;
  seedCardIds: string[];
  goal: string;
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

  // Card methods
  async getCards(filters?: { tag?: string; type?: string; status?: string }): Promise<{ cards: Card[] }> {
    const params = new URLSearchParams();
    if (filters?.tag) params.append('tag', filters.tag);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithAuth(`/api/cards${query}`);
  }

  async createCard(card: { title: string; type?: string; content?: string; tags?: string; status?: string }): Promise<{ card: Card }> {
    return this.fetchWithAuth('/api/cards', {
      method: 'POST',
      body: JSON.stringify(card),
    });
  }

  async updateCard(id: string, updates: Partial<Card>): Promise<{ card: Card }> {
    return this.fetchWithAuth(`/api/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCard(id: string): Promise<{ card: Card }> {
    return this.fetchWithAuth(`/api/cards/${id}`, {
      method: 'DELETE',
    });
  }

  async getCardLinks(cardId: string): Promise<{ outgoing: CardLink[]; incoming: CardLink[] }> {
    return this.fetchWithAuth(`/api/cards/${cardId}/links`);
  }

  // Card link methods
  async createCardLink(link: { from_card_id: string; to_card_id: string; link_type?: string; strength?: number; note?: string }): Promise<{ link: CardLink }> {
    return this.fetchWithAuth('/api/card-links', {
      method: 'POST',
      body: JSON.stringify(link),
    });
  }

  async updateCardLink(id: string, updates: Partial<CardLink>): Promise<{ link: CardLink }> {
    return this.fetchWithAuth(`/api/card-links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCardLink(id: string): Promise<{ link: CardLink }> {
    return this.fetchWithAuth(`/api/card-links/${id}`, {
      method: 'DELETE',
    });
  }

  // Crossing methods
  async runCrossing(params: { seedCardIds: string[]; goal?: string; mode: 'bridge' | 'critique' | 'combine' }): Promise<CrossingResult> {
    return this.fetchWithAuth('/api/crossing/run', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // PR-1: Idea Cards methods
  async getIdeaCards(filters?: { 
    q?: string; 
    tag?: string; 
    status?: string; 
    layer?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ ok: boolean; items: IdeaCard[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.q) params.append('q', filters.q);
    if (filters?.tag) params.append('tag', filters.tag);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.layer) params.append('layer', filters.layer);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithAuth(`/api/idea-cards${query}`);
  }

  async getIdeaCard(id: string): Promise<{ ok: boolean; item: IdeaCard }> {
    return this.fetchWithAuth(`/api/idea-cards/${id}`);
  }

  async createIdeaCard(card: {
    title: string;
    body?: string;
    tags?: string[];
    layer: string;
    value_pct?: number;
    status?: string;
    risk_notes?: string;
    next_steps?: string;
  }): Promise<{ ok: boolean; item: IdeaCard }> {
    return this.fetchWithAuth('/api/idea-cards', {
      method: 'POST',
      body: JSON.stringify(card),
    });
  }

  async updateIdeaCard(id: string, updates: Partial<IdeaCard>): Promise<{ ok: boolean; item: IdeaCard }> {
    return this.fetchWithAuth(`/api/idea-cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteIdeaCard(id: string): Promise<{ ok: boolean }> {
    return this.fetchWithAuth(`/api/idea-cards/${id}`, {
      method: 'DELETE',
    });
  }

  // PR-1: Idea Card Links methods
  async getIdeaCardLinks(cardId: string): Promise<{ ok: boolean; items: IdeaCardLink[] }> {
    return this.fetchWithAuth(`/api/links/by-card/${cardId}`);
  }

  async createIdeaCardLink(link: {
    source_id: string;
    target_id: string;
    type: string;
    weight?: number;
    note?: string;
  }): Promise<{ ok: boolean; item: IdeaCardLink }> {
    return this.fetchWithAuth('/api/links', {
      method: 'POST',
      body: JSON.stringify(link),
    });
  }

  async deleteIdeaCardLink(id: string): Promise<{ ok: boolean }> {
    return this.fetchWithAuth(`/api/links/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
