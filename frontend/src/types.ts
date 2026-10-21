/**
 * Visiteur d'une session de discussion.
 *
 * Aucun compte n'est créé : l'identifiant technique anonyme (pseudonyme)
 * reste côté serveur et n'est jamais exposé au client ni au partenaire.
 */
export interface PublicUser {
  id: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

/**
 * Profil du partenaire : le nom affiché est le seul élément visible.
 * Le pseudonyme reste interne (identifiant technique) et n'est jamais
 * communiqué au partenaire.
 */
export interface PartnerProfile {
  displayName: string;
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
  reportedDisplayName: string;
  createdAt: string;
}

export interface ReportCreatePayload {
  matchId: string;
  reason: ReportReason;
  details?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type ChatStatus = 'idle' | 'waiting' | 'matched';
