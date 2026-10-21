import { Router } from 'express';
import { createSessionController, currentSessionController } from './auth.controller';
import { sessionSchema } from '../../schemas/auth.schema';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rate-limiters';
import { authenticate } from '../../middleware/authenticate';

export const authRouter = Router();

/** Ouvre une session à partir du seul nom affiché saisi par le visiteur. */
authRouter.post(
  '/session',
  authLimiter,
  validate({ body: sessionSchema }),
  createSessionController,
);

/** Session courante (jeton de session valide). */
authRouter.get('/session', authenticate, currentSessionController);
