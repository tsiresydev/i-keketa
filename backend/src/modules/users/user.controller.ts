import type { Request, Response } from 'express';
import { toPrivateUser } from '../../models/user.model';
import { ApiError } from '../../utils/api-error';
import { asyncHandler } from '../../utils/async-handler';

/**
 * Profil de l'utilisateur courant.
 */
export const getCurrentUserController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  res.status(200).json({ user: toPrivateUser(req.user) });
});
