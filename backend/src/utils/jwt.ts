import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './api-error';

export interface TokenPayload {
  sub: string;
  displayName: string;
}

export const signAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    subject: payload.sub,
  };

  return jwt.sign({ displayName: payload.displayName }, env.JWT_SECRET, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof (decoded as { displayName?: unknown }).displayName !== 'string'
    ) {
      throw ApiError.unauthorized('Jeton de session invalide.');
    }

    return { sub: decoded.sub, displayName: (decoded as { displayName: string }).displayName };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.unauthorized('Jeton de session invalide ou expiré.');
  }
};
