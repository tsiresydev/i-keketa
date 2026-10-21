import type { AuthResponse, ChatMessage, PublicUser } from '../types';

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
  session: (displayName: string): Promise<AuthResponse> =>
    request<AuthResponse>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    }),

  me: (token: string): Promise<{ user: PublicUser }> =>
    request<{ user: PublicUser }>('/api/auth/session', { method: 'GET' }, token),
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
