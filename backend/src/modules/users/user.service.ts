import { Types } from 'mongoose';
import {
  UserModel,
  toPrivateUser,
  toPublicUser,
  type PrivateUserDto,
  type PublicUserDto,
} from '../../models/user.model';
import { ApiError } from '../../utils/api-error';
import { normalizeInterests } from '../../utils/text';
import type { ProfileUpdateInput, UserSearchInput } from '../../schemas/user.schema';
import { localPhotoStorage, type PhotoStorage } from './photo-storage.service';

export type UserDirectoryEntry = PublicUserDto;

export interface UserDirectoryResult {
  users: UserDirectoryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const photoStorage: PhotoStorage = localPhotoStorage;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Met à jour le profil de l'utilisateur.
 * Les champs non fournis sont laissés inchangés ; `null` ou une chaîne vide
 * supprime la valeur correspondante.
 */
export const updateProfile = async (
  userId: string,
  input: ProfileUpdateInput,
): Promise<PrivateUserDto> => {
  const updates: Record<string, unknown> = {};

  if (input.displayName !== undefined) {
    updates.displayName = input.displayName;
  }

  if (input.interests !== undefined) {
    updates.interests = normalizeInterests(input.interests);
  }

  if (input.location !== undefined) {
    updates.location = input.location;
  }

  const user = await UserModel.findByIdAndUpdate(userId, { $set: updates }, { new: true });

  if (!user) {
    throw ApiError.notFound('Utilisateur introuvable.');
  }

  return toPrivateUser(user);
};

/**
 * Remplace la photo de profil : l'ancienne est supprimée du stockage.
 */
export const replacePhoto = async (
  userId: string,
  file: { buffer: Buffer; mimetype: string },
): Promise<PrivateUserDto> => {
  const user = await UserModel.findById(userId).select('photoUrl');

  if (!user) {
    throw ApiError.notFound('Utilisateur introuvable.');
  }

  const previousPhotoUrl = user.photoUrl;
  const photoUrl = await photoStorage.save(userId, file);

  const updatedUser = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { photoUrl } },
    { new: true },
  );

  if (!updatedUser) {
    throw ApiError.notFound('Utilisateur introuvable.');
  }

  if (previousPhotoUrl && previousPhotoUrl !== photoUrl) {
    await photoStorage.remove(previousPhotoUrl);
  }

  return toPrivateUser(updatedUser);
};

/**
 * Supprime la photo de profil.
 */
export const removePhoto = async (userId: string): Promise<PrivateUserDto> => {
  const user = await UserModel.findById(userId).select('photoUrl');

  if (!user) {
    throw ApiError.notFound('Utilisateur introuvable.');
  }

  const updatedUser = await UserModel.findByIdAndUpdate(
    userId,
    { $unset: { photoUrl: 1 } },
    { new: true },
  );

  if (!updatedUser) {
    throw ApiError.notFound('Utilisateur introuvable.');
  }

  if (user.photoUrl) {
    await photoStorage.remove(user.photoUrl);
  }

  return toPrivateUser(updatedUser);
};

/**
 * Annuaire des utilisateurs avec filtres (intérêts, localisation, recherche).
 * L'utilisateur connecté n'apparaît jamais dans sa propre liste.
 */
export const listUsers = async (
  currentUserId: string,
  filters: UserSearchInput,
): Promise<UserDirectoryResult> => {
  const query: Record<string, unknown> = {
    _id: { $ne: new Types.ObjectId(currentUserId) },
  };

  if (filters.interests && filters.interests.length > 0) {
    // Un utilisateur correspond s'il partage au moins un des intérêts demandés.
    query.interests = {
      $in: filters.interests.map((interest) => new RegExp(`^${escapeRegExp(interest)}$`, 'i')),
    };
  }

  if (filters.location) {
    query.location = { $regex: escapeRegExp(filters.location), $options: 'i' };
  }

  if (filters.q) {
    const search = new RegExp(escapeRegExp(filters.q), 'i');
    query.$or = [{ displayName: search }, { pseudonym: search }];
  }

  const skip = (filters.page - 1) * filters.limit;

  const [users, total] = await Promise.all([
    UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit),
    UserModel.countDocuments(query),
  ]);

  return {
    users: users.map((user) => toPublicUser(user)),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
};

/**
 * Récupère un profil public par identifiant.
 */
export const findPublicUser = async (userId: string): Promise<PublicUserDto | null> => {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await UserModel.findById(userId);

  return user ? toPublicUser(user) : null;
};
