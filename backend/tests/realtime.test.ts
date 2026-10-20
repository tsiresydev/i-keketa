import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MatchModel } from '../src/models/match.model';
import { MessageModel } from '../src/models/message.model';
import { createTestContext, registerTestUser, type TestContext } from './helpers/test-context';

interface MatchFoundEvent {
  matchId: string;
  partner: { pseudonym: string; displayName?: string; photoUrl?: string };
}

const waitForEvent = <T>(socket: ClientSocket, event: string, timeoutMs = 10_000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Événement « ${event} » non reçu après ${timeoutMs} ms.`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });

const connectClient = (url: string, token: string): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Connexion temps réel impossible.'));
    }, 10_000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });

describe('Temps réel — chat aléatoire et messagerie', () => {
  let context: TestContext;
  let url: string;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    context = await createTestContext();
    const address = context.httpServer.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    url = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.close());
    clients.length = 0;
    await context.close();
  });

  const connect = async (token: string): Promise<ClientSocket> => {
    const client = await connectClient(url, token);
    clients.push(client);
    return client;
  };

  it('refuse une connexion sans jeton valide', async () => {
    await expect(connectClient(url, 'jeton-invalide')).rejects.toThrowError();
  });

  it('met en relation deux utilisateurs et notifie les deux parties', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');

    const [aliceEvent, bobEvent] = await Promise.all([aliceMatch, bobMatch]);

    expect(aliceEvent.matchId).toBe(bobEvent.matchId);
    expect(aliceEvent.partner.pseudonym).toBe(bob.pseudonym);
    expect(bobEvent.partner.pseudonym).toBe(alice.pseudonym);

    const match = await MatchModel.findById(aliceEvent.matchId);
    expect(match?.status).toBe('active');
    expect(match?.participants).toHaveLength(2);
  });

  it('place un utilisateur seul en attente de partenaire', async () => {
    const alice = await registerTestUser(context.app);
    const aliceSocket = await connect(alice.token);

    const status = waitForEvent<{ status: string; position: number }>(aliceSocket, 'queue:status');
    aliceSocket.emit('queue:join');

    const event = await status;

    expect(event.status).toBe('waiting');
    expect(context.realtime.matchmaking.getQueueSize()).toBe(1);
  });

  it('transmet les messages en temps réel et les persiste', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');

    const [{ matchId }] = await Promise.all([aliceMatch, bobMatch]);

    const receivedByBob = waitForEvent<{ message: { content: string; senderId: string } }>(
      bobSocket,
      'chat:message',
    );
    const receivedByAlice = waitForEvent<{ message: { content: string } }>(
      aliceSocket,
      'chat:message',
    );

    aliceSocket.emit('chat:message', { matchId, content: 'Salut, ça va ?' });

    const [bobMessage, aliceMessage] = await Promise.all([receivedByBob, receivedByAlice]);

    expect(bobMessage.message.content).toBe('Salut, ça va ?');
    expect(bobMessage.message.senderId).toBe(alice.userId);
    expect(aliceMessage.message.content).toBe('Salut, ça va ?');

    const persisted = await MessageModel.find({ matchId });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.content).toBe('Salut, ça va ?');
  });

  it('refuse un message vide', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');
    const [{ matchId }] = await Promise.all([aliceMatch, bobMatch]);

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('chat:message', { matchId, content: '   ' });

    expect((await error).code).toBe('INVALID_MESSAGE');
  });

  it('refuse un message si aucune discussion n’est active', async () => {
    const alice = await registerTestUser(context.app);
    const aliceSocket = await connect(alice.token);

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('chat:message', { matchId: '507f1f77bcf86cd799439011', content: 'Bonjour' });

    expect((await error).code).toBe('NO_ACTIVE_MATCH');
  });

  it('prévient le partenaire lors d’une déconnexion', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');
    await Promise.all([aliceMatch, bobMatch]);

    const ended = waitForEvent<{ reason: string }>(bobSocket, 'match:ended');
    aliceSocket.close();

    expect((await ended).reason).toBe('partner_disconnected');

    const match = await MatchModel.findOne({ participants: alice.userId });
    expect(match?.status).toBe('ended');
  });

  it('permet de passer à un autre partenaire (chat:skip)', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');
    await Promise.all([aliceMatch, bobMatch]);

    const ended = waitForEvent<{ reason: string }>(bobSocket, 'match:ended');
    aliceSocket.emit('chat:skip');

    expect((await ended).reason).toBe('user_skipped');
  });

  it('replace un utilisateur déjà en discussion dans la file d’attente', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');
    await Promise.all([aliceMatch, bobMatch]);

    const ended = waitForEvent<{ reason: string }>(bobSocket, 'match:ended');
    const waiting = waitForEvent<{ status: string }>(aliceSocket, 'queue:status');

    aliceSocket.emit('queue:join');

    expect((await ended).reason).toBe('user_skipped');
    expect((await waiting).status).toBe('waiting');
    expect(context.realtime.matchmaking.getQueueSize()).toBe(1);
  });
});

describe('Temps réel — discussion directe (chat:start)', () => {
  let context: TestContext;
  let url: string;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    context = await createTestContext();
    const address = context.httpServer.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    url = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.close());
    clients.length = 0;
    await context.close();
  });

  const connect = async (token: string): Promise<ClientSocket> => {
    const client = await connectClient(url, token);
    clients.push(client);
    return client;
  };

  it('met en relation directe deux utilisateurs connectés', async () => {
    const alice = await registerTestUser(context.app, { displayName: 'Miora' });
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('chat:start', { userId: bob.userId });

    const [aliceEvent, bobEvent] = await Promise.all([aliceMatch, bobMatch]);

    expect(aliceEvent.matchId).toBe(bobEvent.matchId);
    expect(aliceEvent.partner.pseudonym).toBe(bob.pseudonym);
    expect(bobEvent.partner.displayName).toBe('Miora');

    const match = await MatchModel.findById(aliceEvent.matchId);
    expect(match?.status).toBe('active');
    expect(match?.participants).toHaveLength(2);
  });

  it('permet de discuter ensuite dans la session directe', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('chat:start', { userId: bob.userId });

    const [{ matchId }] = await Promise.all([aliceMatch, bobMatch]);

    const received = waitForEvent<{ message: { content: string } }>(bobSocket, 'chat:message');
    aliceSocket.emit('chat:message', { matchId, content: 'Bonjour !' });

    expect((await received).message.content).toBe('Bonjour !');
  });

  it('renvoie USER_UNAVAILABLE si la cible n’est pas connectée', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);

    const error = waitForEvent<{ code: string; message: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('chat:start', { userId: bob.userId });

    expect((await error).code).toBe('USER_UNAVAILABLE');
  });

  it('renvoie USER_UNAVAILABLE si la cible est déjà en discussion', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);
    const charlie = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);
    const charlieSocket = await connect(charlie.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');
    await Promise.all([aliceMatch, bobMatch]);

    const error = waitForEvent<{ code: string }>(charlieSocket, 'chat:error');
    charlieSocket.emit('chat:start', { userId: alice.userId });

    expect((await error).code).toBe('USER_UNAVAILABLE');
  });

  it('refuse de démarrer une discussion avec soi-même', async () => {
    const alice = await registerTestUser(context.app);
    const aliceSocket = await connect(alice.token);

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('chat:start', { userId: alice.userId });

    expect((await error).code).toBe('USER_UNAVAILABLE');
  });

  it('refuse un destinataire invalide', async () => {
    const alice = await registerTestUser(context.app);
    const aliceSocket = await connect(alice.token);

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('chat:start', { userId: 'identifiant-invalide' });

    expect((await error).code).toBe('USER_UNAVAILABLE');
  });

  it('reflète un profil modifié après la connexion du socket', async () => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    // Alice modifie son profil alors que son socket est déjà connecté.
    await request(context.app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ displayName: 'Miora' });

    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');
    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');

    await Promise.all([aliceMatch, bobMatch]);

    expect((await bobMatch).partner.displayName).toBe('Miora');
  });
});
