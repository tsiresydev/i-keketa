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

export interface TestSession {
  token: string;
  userId: string;
  displayName: string;
}

let userCounter = 0;

/**
 * Ouvre une session de test anonyme à partir du seul nom affiché.
 */
export const createTestSession = async (
  app: Express,
  overrides: { displayName?: string } = {},
): Promise<TestSession> => {
  userCounter += 1;
  const displayName = overrides.displayName ?? `Visiteur${userCounter}`;

  const response = await request(app).post('/api/auth/session').send({ displayName });

  if (response.status !== 201) {
    throw new Error(
      `Session de test impossible : ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    token: response.body.token,
    userId: response.body.user.id,
    displayName: response.body.user.displayName,
  };
};
