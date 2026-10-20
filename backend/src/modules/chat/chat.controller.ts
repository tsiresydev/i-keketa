import type { Request, Response } from 'express';
import { assertMatchParticipant, getMatchHistory } from './chat.service';
import { ApiError } from '../../utils/api-error';
import { asyncHandler } from '../../utils/async-handler';

/**
 * Historique des messages d'une session de chat (réservé à ses participants).
 */
export const getChatHistoryController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentification requise.');
  }

  const { matchId } = req.params as { matchId: string };

  await assertMatchParticipant(matchId, String(req.user._id));

  const messages = await getMatchHistory(matchId);

  res.status(200).json({ matchId, messages });
});
