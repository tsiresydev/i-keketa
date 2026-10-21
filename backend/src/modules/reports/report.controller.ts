import type { Request, Response } from 'express';
import { ApiError } from '../../utils/api-error';
import { asyncHandler } from '../../utils/async-handler';
import { createReport, listOwnReports } from './report.service';
import type { ReportCreateInput } from '../../schemas/media.schema';

/**
 * Enregistre un signalement d'abus sur la session de chat courante.
 */
export const createReportController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const report = await createReport(String(req.user._id), req.body as ReportCreateInput);

  res.status(201).json({ report });
});

/**
 * Liste les signalements émis par l'utilisateur courant.
 *
 * Aucun outil de modération n'est exposé : l'utilisateur consulte uniquement
 * ses propres signalements.
 */
export const listOwnReportsController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const reports = await listOwnReports(String(req.user._id));

  res.status(200).json({ reports });
});
