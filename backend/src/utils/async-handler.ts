import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrapper pour propager les rejets de promesses vers le middleware d'erreur.
 */
export const asyncHandler =
  <T>(handler: (req: Request, res: Response, next: NextFunction) => Promise<T>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
