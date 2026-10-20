import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/api-error';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Gestionnaire d'erreurs centralisé.
 * Les erreurs opérationnelles sont exposées au client, les autres restent masquées.
 */
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ApiError) {
    const body: ErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };

    res.status(error.statusCode).json(body);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    } satisfies ErrorResponseBody);
    return;
  }

  if (isDuplicateKeyError(error)) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Cette ressource existe déjà.',
      },
    } satisfies ErrorResponseBody);
    return;
  }

  logger.error('Erreur non gérée.', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue.',
    },
  } satisfies ErrorResponseBody);
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

/**
 * Middleware 404 : route inconnue.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route introuvable : ${req.method} ${req.path}`,
    },
  } satisfies ErrorResponseBody);
};

export const trustProxy = env.isProduction;
