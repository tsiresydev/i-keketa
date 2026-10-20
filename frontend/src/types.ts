export interface PublicUser {
  id: string;
  pseudonym: string;
  displayName?: string;
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

export interface UserDirectoryResponse {
  users: PublicUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserSearchFilters {
  q?: string;
  interests?: string[];
  location?: string;
  page?: number;
  limit?: number;
}

export interface ProfileUpdatePayload {
  displayName?: string;
  interests?: string[];
  location?: string;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

/**
 * Profil du partenaire : le nom affiché et la photo ne sont présents
 * que si l'utilisateur les a explicitement renseignés (anonymat par défaut).
 */
export interface PartnerProfile {
  pseudonym: string;
  displayName?: string;
  photoUrl?: string;
}

export interface MatchFoundPayload {
  matchId: string;
  partner: PartnerProfile;
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
