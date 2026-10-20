import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-value-at-least-32-chars';

/**
 * Connexion à la base de données de test (MongoDB en mémoire) avant chaque fichier de test.
 */
beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error('MONGODB_TEST_URI non défini — le globalSetup n’a pas été exécuté.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
});

afterEach(async () => {
  const { collections } = mongoose.connection;

  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
