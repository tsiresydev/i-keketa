import { z } from 'zod';
import { env } from '../config/env';

/**
 * Schémas de validation du profil utilisateur et des filtres de recherche.
 * Ces schémas sont la source de vérité côté serveur : le frontend aligne sa
 * validation cliente sur ces règles.
 */

export const DISPLAY_NAME_MAX_LENGTH = 60;
export const INTEREST_MAX_LENGTH = 30;
export const INTEREST_MAX_COUNT = 10;
export const LOCATION_MAX_LENGTH = 120;

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Le nom doit contenir au moins 2 caractères.')
  .max(
    DISPLAY_NAME_MAX_LENGTH,
    `Le nom ne peut pas dépasser ${DISPLAY_NAME_MAX_LENGTH} caractères.`,
  );

export const interestSchema = z
  .string()
  .trim()
  .min(1, 'Un centre d’intérêt ne peut pas être vide.')
  .max(
    INTEREST_MAX_LENGTH,
    `Un centre d’intérêt ne peut pas dépasser ${INTEREST_MAX_LENGTH} caractères.`,
  );

export const locationSchema = z
  .string()
  .trim()
  .min(2, 'La localisation doit contenir au moins 2 caractères.')
  .max(
    LOCATION_MAX_LENGTH,
    `La localisation ne peut pas dépasser ${LOCATION_MAX_LENGTH} caractères.`,
  );

/**
 * Champs de profil optionnels, utilisés à l'inscription.
 */
export const optionalProfileFieldsSchema = {
  displayName: displayNameSchema.optional(),
  interests: z
    .array(interestSchema)
    .max(INTEREST_MAX_COUNT, 'Maximum 10 centres d’intérêt.')
    .optional(),
  location: locationSchema.optional(),
};

/**
 * Mise à jour du profil. Les champs absents ne sont pas modifiés.
 */
export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    interests: z
      .array(interestSchema)
      .max(INTEREST_MAX_COUNT, 'Maximum 10 centres d’intérêt.')
      .optional(),
    location: locationSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.displayName !== undefined || data.interests !== undefined || data.location !== undefined,
    { message: 'Aucune modification de profil fournie.' },
  );

export const userSearchSchema = z.object({
  interests: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((interest) => interest.trim())
            .filter((interest) => interest.length > 0)
            .slice(0, INTEREST_MAX_COUNT)
        : undefined,
    ),
  location: z.string().trim().max(LOCATION_MAX_LENGTH).optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const photoUploadSchema = z.object({
  photoUrl: z.string().trim().max(500),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserSearchInput = z.infer<typeof userSearchSchema>;

export const photoStorageConfig = {
  maxFileSizeBytes: env.PHOTO_MAX_SIZE_BYTES,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
