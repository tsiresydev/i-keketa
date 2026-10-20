import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { photoPublicRoot } from './modules/users/photo-storage.service';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { globalLimiter } from './middleware/rate-limiters';

/**
 * Crée l'application Express (sans serveur HTTP) — utilisé aussi par les tests.
 */
export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', env.isProduction ? 1 : false);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // Photos de profil (stockage local). Le contenu est validé à l'upload.
  app.use(
    '/uploads',
    express.static(photoPublicRoot(), {
      fallthrough: true,
      maxAge: env.isProduction ? '7d' : 0,
      index: false,
    }),
  );

  app.use('/api', globalLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/chat', chatRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
