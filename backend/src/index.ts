import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './db/connect';
import { UserModel } from './models/user.model';
import { MatchModel } from './models/match.model';
import { createRealtimeServer } from './realtime/socket.server';

const start = async (): Promise<void> => {
  await connectDatabase();

  // Synchronise les index MongoDB avec les schémas Mongoose : supprime les
  // index uniques obsolètes (ex. email) qui provoquaient des 409 intempestifs.
  await Promise.all([UserModel.syncIndexes(), MatchModel.syncIndexes()]);

  const app = createApp();
  const httpServer = createServer(app);
  const realtime = createRealtimeServer(httpServer);

  // Expose le service de matchmaking pour la présence (compteur en ligne).
  app.locals.matchmaking = realtime.matchmaking;

  app.get('/api/presence', (_req, res) => {
    const matchmaking = app.locals.matchmaking as
      { getOnlineCount: () => number; getAvailableCount: () => number } | undefined;

    if (!matchmaking) {
      res.status(200).json({ online: 0, available: 0 });
      return;
    }

    res.status(200).json({
      online: matchmaking.getOnlineCount(),
      available: matchmaking.getAvailableCount(),
    });
  });

  httpServer.listen(env.PORT, () => {
    logger.info('Serveur I-Keketa démarré.', {
      port: env.PORT,
      environment: env.NODE_ENV,
      cors: env.corsOrigins,
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Arrêt du serveur.', { signal });

    await realtime.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectDatabase();

    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
};

start().catch((error: unknown) => {
  logger.error('Démarrage impossible.', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
