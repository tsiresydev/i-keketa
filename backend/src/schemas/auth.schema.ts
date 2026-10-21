import { z } from 'zod';
import { env } from '../config/env';

/**
 * Schémas de validation des entrées (côté serveur — source de vérité).
 * Les schémas zod rejettent les objets non textuels, ce qui protège
 * contre les injections NoSQL (opérateurs mongo injectés dans le corps JSON).
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Le nom affiché doit contenir au moins 2 caractères.')
  .max(40, 'Le nom affiché ne peut pas dépasser 40 caractères.');

export const sessionSchema = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();

export const messageContentSchema = z
  .object({
    matchId: z.string().trim().min(1, 'Identifiant de session manquant.').max(64),
    content: z
      .string()
      .max(
        env.MESSAGE_MAX_LENGTH,
        `Le message ne peut pas dépasser ${env.MESSAGE_MAX_LENGTH} caractères.`,
      ),
  })
  .strict();

export const matchIdParamSchema = z.object({
  matchId: z.string().trim().min(1).max(64),
});

export type SessionInput = z.infer<typeof sessionSchema>;
export type MessageInput = z.infer<typeof messageContentSchema>;
