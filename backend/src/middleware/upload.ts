import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Middleware d'upload d'une photo de profil.
 * - Un seul fichier, champ `photo`.
 * - Type MIME et taille contrôlés ici ; le contenu binaire est revérifié
 *   dans `photo-storage.service` (signature magic bytes).
 */
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.PHOTO_MAX_SIZE_BYTES,
    files: 1,
    fields: 5,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(
        ApiError.badRequest('Format d’image non accepté. Formats autorisés : JPEG, PNG et WebP.'),
      );
      return;
    }

    callback(null, true);
  },
}).single('photo');

/**
 * Traduit les erreurs techniques de multer en erreurs applicatives homogènes.
 */
export const toUploadApiError = (error: unknown): unknown => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const maxMegabytes = Math.round(env.PHOTO_MAX_SIZE_BYTES / (1024 * 1024));
      return ApiError.badRequest(`La photo ne peut pas dépasser ${maxMegabytes} Mo.`);
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiError.badRequest('Un seul fichier photo est attendu (champ « photo »).');
    }

    return ApiError.badRequest('Téléchargement de photo invalide.');
  }

  return error;
};
