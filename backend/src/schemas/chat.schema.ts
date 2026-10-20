import { z } from 'zod';

/**
 * Schémas de validation des événements temps réel.
 */

/**
 * Démarrage d'une discussion directe : `{ userId }`.
 */
export const directChatSchema = z
  .object({
    userId: z.string().trim().min(1, 'Identifiant du destinataire manquant.').max(64),
  })
  .strict();

export type DirectChatInput = z.infer<typeof directChatSchema>;
