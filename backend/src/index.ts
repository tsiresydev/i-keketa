import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './db/connect';
import { createRealtimeServer } from './realtime/socket.server';

const start = async (): Promise<void> => {
  await connectDatabase();

  const app = createApp();
  const httpServer = createServer(app);
  const realtime = createRealtimeServer(httpServer);

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
