import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

const startInMemoryMongo = async (): Promise<string> => {
  logger.warn(
    'MONGODB_URI non renseignée — démarrage d’un MongoDB en mémoire (usage développement uniquement).',
  );

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create({
    binary: { version: env.MONGOMS_VERSION },
    instance: { launchTimeout: 60_000 },
  });

  memoryServer = server;
  return server.getUri('i-keketa');
};

/**
 * Établit la connexion à MongoDB.
 * En développement, si aucune URI n'est fournie, un MongoDB en mémoire est démarré
 * afin de pouvoir lancer la plateforme sans infrastructure externe.
 */
export const connectDatabase = async (): Promise<string> => {
  let uri = env.MONGODB_URI;

  if (!uri && env.USE_IN_MEMORY_DB) {
    uri = await startInMemoryMongo();
  }

  if (!uri) {
    throw new Error(
      'MONGODB_URI est obligatoire. Renseignez-la dans backend/.env ou activez USE_IN_MEMORY_DB=true en développement.',
    );
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  logger.info('Connexion MongoDB établie.', { database: mongoose.connection.name });
  return uri;
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};
