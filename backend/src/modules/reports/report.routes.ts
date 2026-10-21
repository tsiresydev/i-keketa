import { Router } from 'express';
import { createReportController, listOwnReportsController } from './report.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { reportLimiter } from '../../middleware/rate-limiters';
import { reportCreateSchema } from '../../schemas/media.schema';

export const reportRouter = Router();

reportRouter.post(
  '/',
  authenticate,
  reportLimiter,
  validate({ body: reportCreateSchema }),
  createReportController,
);

reportRouter.get('/me', authenticate, listOwnReportsController);
