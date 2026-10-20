import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Démarre un MongoDB en mémoire partagé par l'ensemble des fichiers de test.
 * L'URI est transmise aux workers via `process.env.MONGODB_TEST_URI`.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION ?? '7.0.24' },
    instance: { launchTimeout: 60_000 },
  });

  process.env.MONGODB_TEST_URI = server.getUri('i-keketa-test');

  return async () => {
    await server.stop();
  };
}
