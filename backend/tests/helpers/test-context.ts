import type { Express } from 'express';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { createApp } from '../../src/app';
import { createRealtimeServer, type RealtimeServer } from '../../src/realtime/socket.server';

export interface TestContext {
  app: Express;
  httpServer: Server;
  realtime: RealtimeServer;
  close: () => Promise<void>;
}

/**
 * Démarre une instance complète (HTTP + temps réel) pour les tests d'intégration.
 */
export const createTestContext = async (): Promise<TestContext> => {
  const app = createApp();
  const httpServer = createServer(app);
  const realtime = createRealtimeServer(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    app,
    httpServer,
    realtime,
    close: async () => {
      await realtime.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
    port,
  } as TestContext & { port: number };
};

export interface RegisteredUser {
  token: string;
  userId: string;
  email: string;
  pseudonym: string;
}

let userCounter = 0;

export const registerTestUser = async (
  app: Express,
  overrides: {
    email?: string;
    password?: string;
    displayName?: string;
    interests?: string[];
    location?: string;
  } = {},
): Promise<RegisteredUser> => {
  userCounter += 1;
  const email = overrides.email ?? `user${userCounter}-${Date.now()}@example.mg`;
  const password = overrides.password ?? 'MotDePasse1';

  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password,
      ...(overrides.displayName ? { displayName: overrides.displayName } : {}),
      ...(overrides.interests ? { interests: overrides.interests } : {}),
      ...(overrides.location ? { location: overrides.location } : {}),
    });

  if (response.status !== 201) {
    throw new Error(
      `Inscription de test impossible : ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
    pseudonym: response.body.user.pseudonym,
  };
};
