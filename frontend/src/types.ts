export interface PublicUser {
  id: string;
  pseudonym: string;
  role: 'user' | 'moderator' | 'admin';
  interests: string[];
  photoUrl?: string;
  location?: string;
  createdAt: string;
}

export interface CurrentUser extends PublicUser {
  email: string;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface MatchFoundPayload {
  matchId: string;
  partner: {
    pseudonym: string;
  };
}

export interface MatchEndedPayload {
  matchId: string;
  reason: 'user_skipped' | 'partner_disconnected' | 'user_disconnected';
}

export interface QueueStatusPayload {
  status: 'idle' | 'waiting';
  position?: number;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type ChatStatus = 'idle' | 'waiting' | 'matched';
