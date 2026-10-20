import { Router } from 'express';
import { getChatHistoryController } from './chat.controller';
import { matchIdParamSchema } from '../../schemas/auth.schema';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';

export const chatRouter = Router();

chatRouter.get(
  '/matches/:matchId/messages',
  authenticate,
  validate({ params: matchIdParamSchema }),
  getChatHistoryController,
);
