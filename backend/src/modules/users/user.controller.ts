import type { Request, Response } from 'express';
import { toPrivateUser } from '../../models/user.model';
import { ApiError } from '../../utils/api-error';
import { asyncHandler } from '../../utils/async-handler';
import { listUsers, removePhoto, replacePhoto, updateProfile } from './user.service';
import type { ProfileUpdateInput, UserSearchInput } from '../../schemas/user.schema';

/**
 * Profil de l'utilisateur courant.
 */
export const getCurrentUserController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  res.status(200).json({ user: toPrivateUser(req.user) });
});

/**
 * Mise à jour du profil (nom affiché, centres d'intérêt, localisation).
 */
export const updateProfileController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const user = await updateProfile(String(req.user._id), req.body as ProfileUpdateInput);

  res.status(200).json({ user });
});

/**
 * Envoi d'une photo de profil (multipart/form-data, champ `photo`).
 */
export const uploadPhotoController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const file = req.file;

  if (!file) {
    throw ApiError.badRequest('Aucune photo n’a été fournie.');
  }

  const user = await replacePhoto(String(req.user._id), {
    buffer: file.buffer,
    mimetype: file.mimetype,
  });

  res.status(200).json({ user });
});

/**
 * Suppression de la photo de profil.
 */
export const deletePhotoController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const user = await removePhoto(String(req.user._id));

  res.status(200).json({ user });
});

/**
 * Annuaire des utilisateurs, filtrable par intérêts, localisation ou recherche.
 */
export const listUsersController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const result = await listUsers(String(req.user._id), req.query as unknown as UserSearchInput);

  res.status(200).json(result);
});
