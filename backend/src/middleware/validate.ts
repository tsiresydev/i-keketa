import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/api-error';

type RequestSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

/**
 * Middleware de validation : vérifie et transforme les entrées selon les schémas zod.
 * Les données validées remplacent les données d'origine (`req.body`, `req.params`, `req.query`).
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          throw ApiError.badRequest('Données invalides.', formatIssues(result.error.issues));
        }
        req.body = result.data;
      }

      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          throw ApiError.badRequest('Paramètres invalides.', formatIssues(result.error.issues));
        }
        req.params = result.data as Request['params'];
      }

      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          throw ApiError.badRequest(
            'Paramètres de requête invalides.',
            formatIssues(result.error.issues),
          );
        }
        req.query = result.data as Request['query'];
      }

      next();
    } catch (error) {
      next(error);
    }
  };

const formatIssues = (issues: { path: (string | number)[]; message: string }[]): unknown =>
  issues.map((issue) => ({
    field: issue.path.join('.') || 'global',
    message: issue.message,
  }));
