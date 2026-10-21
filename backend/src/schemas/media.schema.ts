import { z } from 'zod';

/**
 * Schémas de validation du Sprint 3 : signalisation temps réel des appels
 * audiovisuels.
 */

/** Taille maximale d'une description SDP transmise au serveur. */
export const SDP_MAX_LENGTH = 8000;
/** Taille maximale d'un candidat ICE sérialisé. */
export const ICE_CANDIDATE_MAX_LENGTH = 2000;

export const mediaRequestSchema = z
  .object({
    matchId: z.string().trim().min(1, 'Identifiant de session manquant.').max(64),
    audio: z.boolean().default(true),
    video: z.boolean().default(true),
  })
  .strict();

export const mediaOfferSchema = z
  .object({
    matchId: z.string().trim().min(1).max(64),
    description: z.string().min(1).max(SDP_MAX_LENGTH),
  })
  .strict();

export const mediaAnswerSchema = mediaOfferSchema;

export const mediaAcceptSchema = z
  .object({
    matchId: z.string().trim().min(1, 'Identifiant de session manquant.').max(64),
  })
  .strict();

export const mediaCandidateSchema = z
  .object({
    matchId: z.string().trim().min(1).max(64),
    candidate: z.string().min(1).max(ICE_CANDIDATE_MAX_LENGTH),
  })
  .strict();

export const mediaStateSchema = z
  .object({
    matchId: z.string().trim().min(1).max(64),
    audio: z.boolean(),
    video: z.boolean(),
  })
  .strict();

export const mediaEndSchema = z
  .object({
    matchId: z.string().trim().min(1).max(64),
  })
  .strict();

export type MediaRequestInput = z.infer<typeof mediaRequestSchema>;
export type MediaOfferInput = z.infer<typeof mediaOfferSchema>;
export type MediaCandidateInput = z.infer<typeof mediaCandidateSchema>;
export type MediaStateInput = z.infer<typeof mediaStateSchema>;
