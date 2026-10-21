import type { Request, Response } from 'express';
import { createSession } from './auth.service';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';

export const createSessionController = asyncHandler(async (req: Request, res: Response) => {
  const result = await createSession(req.body);

  res.status(201).json(result);
});

export const currentSessionController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  res.status(200).json({
    user: {
      id: String(req.user._id),
      displayName: req.displayName ?? '',
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
});
