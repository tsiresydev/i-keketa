import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/api-error';

export interface PhotoStorage {
  save: (userId: string, file: { buffer: Buffer; mimetype: string }) => Promise<string>;
  remove: (photoUrl: string) => Promise<void>;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Signatures binaires des formats acceptés (protection contre un fichier
 * renommé dont le type déclaré ne correspond pas au contenu réel).
 */
const MAGIC_BYTES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

export const detectImageMimeType = (buffer: Buffer): string | null => {
  for (const signature of MAGIC_BYTES) {
    const offset = signature.offset ?? 0;
    const matches = signature.bytes.every((byte, index) => buffer[offset + index] === byte);

    if (matches) {
      return signature.mime;
    }
  }

  return null;
};

const storageRoot = (): string => path.resolve(process.cwd(), env.PHOTO_STORAGE_DIR);

/**
 * Racine publique des photos servies par `express.static` sur `/uploads`.
 */
export const photoPublicRoot = (): string => path.resolve(process.cwd(), 'uploads');

const ensureStorageDirectory = async (): Promise<string> => {
  const directory = storageRoot();
  await fs.mkdir(directory, { recursive: true });
  return directory;
};

/**
 * Stockage local des photos de profil.
 *
 * En production sur un hébergeur éphémère (Vercel), ce stockage n'est pas durable :
 * le service `photoStorage` est le point d'extension prévu pour brancher un stockage
 * objet (S3, Cloudinary) sans modifier le reste de l'application.
 */
export const localPhotoStorage: PhotoStorage = {
  save: async (userId, file) => {
    const detectedMimeType = detectImageMimeType(file.buffer);

    if (!detectedMimeType || detectedMimeType !== file.mimetype) {
      throw ApiError.badRequest(
        'Format d’image non accepté. Formats autorisés : JPEG, PNG et WebP.',
      );
    }

    const extension = EXTENSION_BY_MIME[detectedMimeType] ?? '.img';
    const fileName = `${userId}-${randomUUID()}${extension}`;
    const directory = await ensureStorageDirectory();

    await fs.writeFile(path.join(directory, fileName), file.buffer);

    logger.info('Photo de profil enregistrée.', { userId, mimeType: detectedMimeType });

    return `/uploads/photos/${fileName}`;
  },

  remove: async (photoUrl) => {
    if (!photoUrl.startsWith('/uploads/photos/')) {
      return;
    }

    const fileName = path.basename(photoUrl);

    try {
      await fs.unlink(path.join(storageRoot(), fileName));
    } catch (error) {
      logger.warn('Suppression de la photo impossible.', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * Empreinte du contenu d'un fichier (utile pour les tests et le dédoublonnage).
 */
export const hashPhoto = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');
