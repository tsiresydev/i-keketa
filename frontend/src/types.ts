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

/* ---------- Sprint 3 : appel audiovisuel ---------- */

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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type ChatStatus = 'idle' | 'waiting' | 'matched';
