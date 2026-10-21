import type {
  AuthResponse,
  ChatMessage,
  CurrentUser,
  ProfileUpdatePayload,
  Report,
  ReportCreatePayload,
  UserDirectoryResponse,
  UserSearchFilters,
} from '../types';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const parseError = async (response: Response): Promise<ApiRequestError> => {
  let payload: ApiErrorPayload | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }

  return new ApiRequestError(
    response.status,
    payload?.error.code ?? 'UNKNOWN_ERROR',
    payload?.error.message ?? 'Une erreur est survenue, veuillez réessayer.',
    payload?.error.details,
  );
};

const request = async <T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> => {
  const headers = new Headers(init.headers);

  // Le contenu d'un FormData est déjà encodé (multipart) : ne pas fixer le type.
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Impossible de joindre le serveur. Vérifiez votre connexion internet.',
    );
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const authApi = {
  register: (
    email: string,
    password: string,
    profile?: ProfileUpdatePayload,
  ): Promise<AuthResponse> =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(profile ?? {}) }),
    }),

  login: (email: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string): Promise<{ user: CurrentUser }> =>
    request<{ user: CurrentUser }>('/api/users/me', { method: 'GET' }, token),
};

export const chatApi = {
  history: (
    matchId: string,
    token: string,
  ): Promise<{ matchId: string; messages: ChatMessage[] }> =>
    request<{ matchId: string; messages: ChatMessage[] }>(
      `/api/chat/matches/${encodeURIComponent(matchId)}/messages`,
      { method: 'GET' },
      token,
    ),
};

export const profileApi = {
  update: (token: string, payload: ProfileUpdatePayload): Promise<{ user: CurrentUser }> =>
    request<{ user: CurrentUser }>(
      '/api/users/me',
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    ),

  uploadPhoto: (token: string, file: File): Promise<{ user: CurrentUser }> => {
    const formData = new FormData();
    formData.append('photo', file);

    return request<{ user: CurrentUser }>(
      '/api/users/me/photo',
      { method: 'POST', body: formData },
      token,
    );
  },

  deletePhoto: (token: string): Promise<{ user: CurrentUser }> =>
    request<{ user: CurrentUser }>('/api/users/me/photo', { method: 'DELETE' }, token),
};

export const usersApi = {
  search: (token: string, filters: UserSearchFilters = {}): Promise<UserDirectoryResponse> => {
    const params = new URLSearchParams();

    if (filters.q) {
      params.set('q', filters.q);
    }

    if (filters.interests && filters.interests.length > 0) {
      params.set('interests', filters.interests.join(','));
    }

    if (filters.location) {
      params.set('location', filters.location);
    }

    if (filters.page) {
      params.set('page', String(filters.page));
    }

    if (filters.limit) {
      params.set('limit', String(filters.limit));
    }

    const query = params.toString();

    return request<UserDirectoryResponse>(
      `/api/users${query ? `?${query}` : ''}`,
      { method: 'GET' },
      token,
    );
  },
};

export const reportsApi = {
  create: (token: string, payload: ReportCreatePayload): Promise<{ report: Report }> =>
    request<{ report: Report }>(
      '/api/reports',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  listOwn: (token: string): Promise<{ reports: Report[] }> =>
    request<{ reports: Report[] }>('/api/reports/me', { method: 'GET' }, token),
};
