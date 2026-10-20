import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './api-error';

export interface TokenPayload {
  sub: string;
  email: string;
}

export const signAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    subject: payload.sub,
  };

  return jwt.sign({ email: payload.email }, env.JWT_SECRET, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw ApiError.unauthorized('Jeton d’authentification invalide.');
    }

    const email = typeof decoded.email === 'string' ? decoded.email : '';

    return { sub: decoded.sub, email };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.unauthorized('Jeton d’authentification invalide ou expiré.');
  }
};
