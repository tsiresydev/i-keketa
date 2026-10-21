import type { NextFunction, Request, Response } from 'express';
import { findUserById } from '../modules/auth/auth.service';
import { ApiError } from '../utils/api-error';
import { verifyAccessToken } from '../utils/jwt';

const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

/**
 * Middleware d'authentification : valide le jeton JWT et charge l'utilisateur.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw ApiError.unauthorized('Authentification requise.');
    }

    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      throw ApiError.unauthorized('Authentification requise.');
    }

    req.user = user;
    req.displayName = payload.displayName;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : ApiError.unauthorized('Authentification requise.'));
  }
};
