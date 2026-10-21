import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CallSessionModel } from '../src/models/call-session.model';
import { createTestContext, registerTestUser, type TestContext } from './helpers/test-context';

interface MatchFoundEvent {
  matchId: string;
  partner: { pseudonym: string };
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

/**
 * Attend un événement sans échouer s'il n'arrive pas : plusieurs issues
 * sont possibles (événement reçu ou absence d'événement).
 */
const collectEvent = <T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 10_000,
): Promise<T | null> =>
  new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
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

describe('Temps réel — signalisation des appels audiovisuels', () => {
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

  /**
   * Met deux utilisateurs en relation et renvoie leurs sockets et la session.
   */
  const matchPair = async (): Promise<{
    aliceSocket: ClientSocket;
    bobSocket: ClientSocket;
    matchId: string;
  }> => {
    const alice = await registerTestUser(context.app);
    const bob = await registerTestUser(context.app);

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const aliceMatch = waitForEvent<MatchFoundEvent>(aliceSocket, 'match:found');
    const bobMatch = waitForEvent<MatchFoundEvent>(bobSocket, 'match:found');

    aliceSocket.emit('queue:join');
    bobSocket.emit('queue:join');

    const [aliceEvent] = await Promise.all([aliceMatch, bobMatch]);

    return { aliceSocket, bobSocket, matchId: aliceEvent.matchId };
  };

  it('relaye la demande d’appel au partenaire et crée la session d’appel', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    const requestReceived = waitForEvent<{ matchId: string; audio: boolean }>(
      bobSocket,
      'media:request',
    );

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });

    const payload = await requestReceived;
    expect(payload.matchId).toBe(matchId);
    expect(payload.audio).toBe(true);

    const session = await CallSessionModel.findOne({ matchId });
    expect(session?.status).toBe('pending');
    expect(session?.participants).toHaveLength(2);
  });

  it('refuse une seconde demande d’appel sur la même session', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    await waitForEvent(bobSocket, 'media:request');

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('media:request', { matchId, audio: true, video: true });

    expect((await error).code).toBe('CALL_ALREADY_ACTIVE');
  });

  it('ne crée qu’un seul appel lorsque les deux participants demandent en même temps', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    const aliceRequest = collectEvent<{ matchId: string }>(aliceSocket, 'media:request');
    const bobRequest = collectEvent<{ matchId: string }>(bobSocket, 'media:request');
    const aliceError = collectEvent<{ code: string }>(aliceSocket, 'chat:error');
    const bobError = collectEvent<{ code: string }>(bobSocket, 'chat:error');

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    bobSocket.emit('media:request', { matchId, audio: true, video: true });

    const [aliceRequestPayload, bobRequestPayload, aliceErrorPayload, bobErrorPayload] =
      await Promise.all([aliceRequest, bobRequest, aliceError, bobError]);

    // Une seule demande est relayée, l'autre est rejetée.
    const relayed = [aliceRequestPayload, bobRequestPayload].filter((payload) => payload !== null);
    const rejected = [aliceErrorPayload, bobErrorPayload].filter(
      (payload) => payload?.code === 'CALL_ALREADY_ACTIVE',
    );

    expect(relayed).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Une seule session d'appel est créée en base.
    const sessions = await CallSessionModel.find({ matchId });
    expect(sessions).toHaveLength(1);
  });

  it('refuse un appel sans session de chat active', async () => {
    const alice = await registerTestUser(context.app);
    const aliceSocket = await connect(alice.token);

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('media:request', {
      matchId: '507f1f77bcf86cd799439011',
      audio: true,
      video: true,
    });

    expect((await error).code).toBe('NO_ACTIVE_MATCH');
  });

  it('active la session d’appel lorsque le partenaire accepte', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    await waitForEvent(bobSocket, 'media:request');

    const accepted = waitForEvent<{ matchId: string }>(aliceSocket, 'media:accepted');
    bobSocket.emit('media:accept', { matchId });

    expect((await accepted).matchId).toBe(matchId);

    const session = await CallSessionModel.findOne({ matchId });
    expect(session?.status).toBe('active');
    expect(session?.startedAt).toBeDefined();
  });

  it('relaye la description SDP et les candidats ICE', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    const offerReceived = waitForEvent<{ description: string }>(bobSocket, 'media:offer');
    aliceSocket.emit('media:offer', { matchId, description: '{"type":"offer","sdp":"v=0"}' });

    expect((await offerReceived).description).toContain('offer');

    const candidateReceived = waitForEvent<{ candidate: string }>(bobSocket, 'media:candidate');
    aliceSocket.emit('media:candidate', {
      matchId,
      candidate: '{"candidate":"candidate:1 1 udp","sdpMid":"0"}',
    });

    expect((await candidateReceived).candidate).toContain('candidate');
  });

  it('relaye l’état du micro et de la caméra', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    const stateReceived = waitForEvent<{ audio: boolean; video: boolean }>(
      bobSocket,
      'media:state',
    );

    aliceSocket.emit('media:state', { matchId, audio: false, video: true });

    const state = await stateReceived;
    expect(state.audio).toBe(false);
    expect(state.video).toBe(true);
  });

  it('clôture la session d’appel et prévient le partenaire', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    await waitForEvent(bobSocket, 'media:request');

    const ended = waitForEvent<{ reason: string }>(bobSocket, 'media:ended');
    aliceSocket.emit('media:end', { matchId });

    expect((await ended).reason).toBe('hangup');

    const session = await CallSessionModel.findOne({ matchId });
    expect(session?.status).toBe('ended');
    expect(session?.endedReason).toBe('hangup');
  });

  it('clôture l’appel lorsque la session de chat prend fin', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    await waitForEvent(bobSocket, 'media:request');

    const ended = waitForEvent<{ reason: string }>(bobSocket, 'match:ended');
    aliceSocket.emit('chat:skip');

    await ended;

    const session = await CallSessionModel.findOne({ matchId });
    expect(session?.status).toBe('ended');
  });

  it('refuse un payload invalide', async () => {
    const { aliceSocket } = await matchPair();

    const error = waitForEvent<{ code: string }>(aliceSocket, 'chat:error');
    aliceSocket.emit('media:offer', { matchId: 'x', description: '' });

    expect((await error).code).toBe('INVALID_PAYLOAD');
  });

  it('clôture un appel resté sans réponse', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    await waitForEvent(bobSocket, 'media:request');

    const endedForAlice = waitForEvent<{ reason: string }>(aliceSocket, 'media:ended');
    const endedForBob = waitForEvent<{ reason: string }>(bobSocket, 'media:ended');

    await context.realtime.media.expirePendingCall(matchId);

    expect((await endedForAlice).reason).toBe('media_failed');
    expect((await endedForBob).reason).toBe('media_failed');

    const session = await CallSessionModel.findOne({ matchId });
    expect(session?.status).toBe('ended');
    expect(session?.endedReason).toBe('media_failed');
  });

  it('autorise une nouvelle demande d’appel après la clôture du précédent', async () => {
    const { aliceSocket, bobSocket, matchId } = await matchPair();

    aliceSocket.emit('media:request', { matchId, audio: true, video: true });
    await waitForEvent(bobSocket, 'media:request');

    aliceSocket.emit('media:end', { matchId });
    await waitForEvent(bobSocket, 'media:ended');

    const secondRequest = waitForEvent<{ matchId: string }>(bobSocket, 'media:request');
    aliceSocket.emit('media:request', { matchId, audio: true, video: true });

    expect((await secondRequest).matchId).toBe(matchId);
  });
});
