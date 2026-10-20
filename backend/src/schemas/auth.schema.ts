import { z } from 'zod';
import { env } from '../config/env';

/**
 * Schémas de validation des entrées (côté serveur — source de vérité).
 * Les schémas zod rejettent les objets non textuels, ce qui protège
 * contre les injections NoSQL (opérateurs mongo injectés dans le corps JSON).
 */
const emailSchema = z
  .string()
  .trim()
  .min(1, 'L’adresse email est requise.')
  .max(254, 'L’adresse email est trop longue.')
  .email('L’adresse email doit être valide.')
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128, 'Le mot de passe est trop long.')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une lettre minuscule.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une lettre majuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis.').max(128),
});

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MessageInput = z.infer<typeof messageContentSchema>;
