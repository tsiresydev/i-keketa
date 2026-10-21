import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Limites de débit.
 * Exposées dans un objet mutable pour permettre un ajustement fin
 * (tests d'intégration, réglage en cours d'exécution).
 */
export const rateLimits = {
  globalMax: env.RATE_LIMIT_MAX,
  authMax: env.AUTH_RATE_LIMIT_MAX,
  reportMax: env.REPORT_RATE_LIMIT_MAX,
};

const buildLimiter = (resolveMax: () => number, message: string): RateLimitRequestHandler =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: () => resolveMax(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message,
      },
    },
  });

/** Limite globale de l'API. */
export const globalLimiter = buildLimiter(
  () => rateLimits.globalMax,
  'Trop de requêtes, veuillez réessayer plus tard.',
);

/** Limite renforcée sur les routes d'authentification (anti bruteforce). */
export const authLimiter = buildLimiter(
  () => rateLimits.authMax,
  'Trop de tentatives, veuillez réessayer plus tard.',
);

/**
 * Limite dédiée aux signalements d'abus (anti-spam).
 * Fenêtre propre à la fonctionnalité (`REPORT_RATE_LIMIT_WINDOW_MS`).
 */
export const reportLimiter = rateLimit({
  windowMs: env.REPORT_RATE_LIMIT_WINDOW_MS,
  limit: () => rateLimits.reportMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop de signalements envoyés. Réessayez plus tard.',
    },
  },
});
