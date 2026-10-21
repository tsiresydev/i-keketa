import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { MatchModel } from '../src/models/match.model';
import { ReportModel } from '../src/models/report.model';
import { rateLimits } from '../src/middleware/rate-limiters';
import { createTestSession } from './helpers/test-context';

const app = createApp();

let previousReportMax = 0;

beforeAll(() => {
  // La limitation de débit est testée par ailleurs : on la relève ici pour
  // que les cas fonctionnels ne se chevauchent pas.
  previousReportMax = rateLimits.reportMax;
  rateLimits.reportMax = 1000;
});

afterAll(() => {
  rateLimits.reportMax = previousReportMax;
});

const createMatch = async (aliceId: string, bobId: string): Promise<string> => {
  const match = await MatchModel.create({
    participants: [new Types.ObjectId(aliceId), new Types.ObjectId(bobId)],
    status: 'active',
  });

  return String(match._id);
};

describe('POST /api/reports', () => {
  it('enregistre un signalement avec le partenaire comme utilisateur signalé', async () => {
    const alice = await createTestSession(app, { displayName: 'Miora' });
    const bob = await createTestSession(app, { displayName: 'Rakoto' });
    const matchId = await createMatch(alice.userId, bob.userId);

    const response = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId, reason: 'harassment', details: 'Insistances déplacées.' });

    expect(response.status).toBe(201);
    expect(response.body.report.status).toBe('pending');
    expect(response.body.report.reason).toBe('harassment');
    expect(response.body.report.matchId).toBe(matchId);
    expect(response.body.report.reportedDisplayName).toBe('Rakoto');
    expect(response.body.report.reportedPseudonym).toBeUndefined();

    const stored = await ReportModel.findOne({ matchId });
    expect(stored?.reporterId.toString()).toBe(alice.userId);
    expect(stored?.reportedId.toString()).toBe(bob.userId);
    expect(stored?.status).toBe('pending');
  });

  it('refuse un second signalement pour la même session', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);
    const matchId = await createMatch(alice.userId, bob.userId);

    const first = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId, reason: 'spam' });

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId, reason: 'spam' });

    expect(second.status).toBe(409);
    expect(await ReportModel.countDocuments({ matchId })).toBe(1);
  });

  it('autorise chaque participant à signaler la session', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);
    const matchId = await createMatch(alice.userId, bob.userId);

    const fromAlice = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId, reason: 'nudity' });

    const fromBob = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ matchId, reason: 'nudity' });

    expect(fromAlice.status).toBe(201);
    expect(fromBob.status).toBe(201);
    expect(await ReportModel.countDocuments({ matchId })).toBe(2);
  });

  it('refuse un signalement depuis une session inconnue', async () => {
    const alice = await createTestSession(app);

    const response = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId: '507f1f77bcf86cd799439011', reason: 'other' });

    expect(response.status).toBe(404);
  });

  it('refuse un signalement depuis une session clôturée', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);

    const match = await MatchModel.create({
      participants: [new Types.ObjectId(alice.userId), new Types.ObjectId(bob.userId)],
      status: 'ended',
    });

    const response = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId: String(match._id), reason: 'other' });

    expect(response.status).toBe(404);
  });

  it('refuse un signalement par un tiers', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);
    const mallory = await createTestSession(app);
    const matchId = await createMatch(alice.userId, bob.userId);

    const response = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${mallory.token}`)
      .send({ matchId, reason: 'scam' });

    expect(response.status).toBe(404);
    expect(await ReportModel.countDocuments({ matchId })).toBe(0);
  });

  it('refuse un motif invalide', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);
    const matchId = await createMatch(alice.userId, bob.userId);

    const response = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId, reason: 'raison_inconnue' });

    expect(response.status).toBe(400);
  });

  it('exige une authentification', async () => {
    const response = await request(app)
      .post('/api/reports')
      .send({ matchId: '507f1f77bcf86cd799439011', reason: 'other' });

    expect(response.status).toBe(401);
  });
});

describe('GET /api/reports/me', () => {
  it('ne renvoie que les signalements de l’utilisateur courant', async () => {
    const alice = await createTestSession(app);
    const bob = await createTestSession(app);
    const charlie = await createTestSession(app);

    const aliceMatch = await createMatch(alice.userId, bob.userId);
    const charlieMatch = await createMatch(charlie.userId, bob.userId);

    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ matchId: aliceMatch, reason: 'harassment' });

    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${charlie.token}`)
      .send({ matchId: charlieMatch, reason: 'spam' });

    const response = await request(app)
      .get('/api/reports/me')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0].matchId).toBe(aliceMatch);
    expect(response.body.reports[0].status).toBe('pending');
  });

  it('exige une authentification', async () => {
    const response = await request(app).get('/api/reports/me');

    expect(response.status).toBe(401);
  });
});
