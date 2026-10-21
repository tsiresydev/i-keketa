import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { MatchModel } from '../src/models/match.model';
import { MessageModel } from '../src/models/message.model';
import { createTestSession } from './helpers/test-context';

const app = createApp();

describe('GET /api/chat/matches/:matchId/messages', () => {
  it('renvoie l’historique aux participants de la session', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);

    const match = await MatchModel.create({
      participants: [new Types.ObjectId(alice.userId), new Types.ObjectId(bob.userId)],
      participantDisplayNames: [alice.displayName ?? 'Anonyme', bob.displayName ?? 'Anonyme'],
      status: 'active',
    });

    await MessageModel.create({
      matchId: match._id,
      senderId: new Types.ObjectId(alice.userId),
      recipientId: new Types.ObjectId(bob.userId),
      content: 'Bonjour !',
    });

    const response = await request(app)
      .get(`/api/chat/matches/${String(match._id)}/messages`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.messages[0].content).toBe('Bonjour !');
  });

  it('refuse l’accès à un tiers', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);
    const mallory = await createTestSession(app);

    const match = await MatchModel.create({
      participants: [new Types.ObjectId(alice.userId), new Types.ObjectId(bob.userId)],
      participantDisplayNames: [alice.displayName ?? 'Anonyme', bob.displayName ?? 'Anonyme'],
      status: 'active',
    });

    const response = await request(app)
      .get(`/api/chat/matches/${String(match._id)}/messages`)
      .set('Authorization', `Bearer ${mallory.token}`);

    expect(response.status).toBe(403);
  });

  it('renvoie 404 pour une session inconnue', async () => {
    const alice = await createTestSession(app);

    const response = await request(app)
      .get('/api/chat/matches/507f1f77bcf86cd799439011/messages')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(404);
  });

  it('exige une authentification', async () => {
    const response = await request(app).get('/api/chat/matches/507f1f77bcf86cd799439011/messages');

    expect(response.status).toBe(401);
  });
});
