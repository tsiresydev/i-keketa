import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createTestSession } from './helpers/test-context';

const app = createApp();

describe('POST /api/auth/session', () => {
  it('ouvre une session anonyme à partir du seul nom affiché', async () => {
    const response = await request(app).post('/api/auth/session').send({ displayName: 'Rakoto' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      token: expect.any(String),
      user: {
        id: expect.any(String),
        displayName: 'Rakoto',
        role: 'user',
      },
    });
  });

  it('n’expose jamais le pseudonyme technique anonyme', async () => {
    const response = await request(app).post('/api/auth/session').send({ displayName: 'Rakoto' });

    expect(response.body.user.pseudonym).toBeUndefined();
  });

  it('ne renvoie jamais d’email ni de hash de mot de passe', async () => {
    const response = await request(app).post('/api/auth/session').send({ displayName: 'Miora' });

    expect(response.body.user.email).toBeUndefined();
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.interests).toBeUndefined();
    expect(response.body.user.photoUrl).toBeUndefined();
  });

  it('refuse un nom affiché trop court', async () => {
    const response = await request(app).post('/api/auth/session').send({ displayName: 'A' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('refuse un nom affiché trop long', async () => {
    const response = await request(app)
      .post('/api/auth/session')
      .send({ displayName: 'a'.repeat(41) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('refuse un nom affiché absent', async () => {
    const response = await request(app).post('/api/auth/session').send({});

    expect(response.status).toBe(400);
  });

  it('refuse un corps qui n’est pas un objet (protection injection NoSQL)', async () => {
    const response = await request(app)
      .post('/api/auth/session')
      .send({ displayName: { $ne: null } });

    expect(response.status).toBe(400);
  });

  it('refuse un champ inconnu', async () => {
    const response = await request(app)
      .post('/api/auth/session')
      .send({ displayName: 'Rakoto', email: 'rakoto@example.mg' });

    expect(response.status).toBe(400);
  });

  it('crée une session distincte à chaque visite', async () => {
    const first = await createTestSession(app, { displayName: 'Rakoto' });
    const second = await createTestSession(app, { displayName: 'Rakoto' });

    expect(first.userId).not.toBe(second.userId);
    expect(first.token).not.toBe(second.token);
  });
});

describe('GET /api/auth/session', () => {
  it('renvoie la session courante', async () => {
    const session = await createTestSession(app, { displayName: 'Rakoto' });

    const response = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${session.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.displayName).toBe('Rakoto');
    expect(response.body.user.id).toBe(session.userId);
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('refuse un accès sans jeton', async () => {
    const response = await request(app).get('/api/auth/session');

    expect(response.status).toBe(401);
  });

  it('refuse un jeton invalide', async () => {
    const response = await request(app)
      .get('/api/auth/session')
      .set('Authorization', 'Bearer jeton-invalide');

    expect(response.status).toBe(401);
  });
});

describe('Routes retirées', () => {
  it('ne renvoie plus l’API d’inscription', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'rakoto@example.mg', password: 'MotDePasse1' });

    expect(response.status).toBe(404);
  });

  it('ne renvoie plus l’API de connexion', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rakoto@example.mg', password: 'MotDePasse1' });

    expect(response.status).toBe(404);
  });

  it('ne renvoie plus l’annuaire des utilisateurs', async () => {
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(404);
  });
});

describe('GET /health', () => {
  it('indique que le service est opérationnel', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
