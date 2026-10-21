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

/* ---------- Sprint 3 : appel audiovisuel et signalement ---------- */

/**
 * États possibles d'un appel audiovisuel.
 * - `idle` : aucun appel.
 * - `requesting` : appel demandé, en attente de la réponse du partenaire.
 * - `ringing` : appel entrant, en attente de l'utilisateur.
 * - `connecting` : médias negotiating (négociation WebRTC en cours).
 * - `in-call` : appel en cours.
 */
export type MediaCallStatus = 'idle' | 'requesting' | 'ringing' | 'connecting' | 'in-call';

export interface MediaCallStatePayload {
  matchId: string;
  audio: boolean;
  video: boolean;
}

export const REPORT_REASONS = [
  'harassment',
  'inappropriate_content',
  'nudity',
  'spam',
  'scam',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: 'Harcèlement ou insultes',
  inappropriate_content: 'Contenu inapproprié',
  nudity: 'Nudité ou contenu sexuel',
  spam: 'Spam ou publicité',
  scam: 'Arnaque ou tentative d’escroquerie',
  other: 'Autre comportement inapproprié',
};

export interface Report {
  id: string;
  matchId: string;
  reason: ReportReason;
  details?: string;
  status: 'pending';
  reportedPseudonym: string;
  createdAt: string;
}

export interface ReportCreatePayload {
  matchId: string;
  reason: ReportReason;
  details?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type ChatStatus = 'idle' | 'waiting' | 'matched';
