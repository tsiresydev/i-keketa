import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { registerTestUser } from './helpers/test-context';

const app = createApp();

describe('POST /api/auth/register', () => {
  it('inscrit un utilisateur avec un email valide et renvoie un jeton', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Rakoto@example.mg', password: 'MotDePasse1' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      token: expect.any(String),
      user: {
        email: 'rakoto@example.mg',
        pseudonym: expect.any(String),
      },
    });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('refuse un email invalide', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pas-un-email', password: 'MotDePasse1' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('refuse un mot de passe trop court', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'court@example.mg', password: 'court' });

    expect(response.status).toBe(400);
  });

  it('refuse un mot de passe sans majuscule', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'faible@example.mg', password: 'motdepasse1' });

    expect(response.status).toBe(400);
  });

  it('refuse un mot de passe sans chiffre', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'faible2@example.mg', password: 'MotDePasse' });

    expect(response.status).toBe(400);
  });

  it('refuse un email déjà utilisé', async () => {
    await registerTestUser(app, { email: 'doublon@example.mg' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'doublon@example.mg', password: 'MotDePasse1' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('refuse un corps qui n’est pas un objet (protection injection NoSQL)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: { $ne: null }, password: 'MotDePasse1' });

    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte un utilisateur avec des identifiants valides', async () => {
    const registered = await registerTestUser(app, {
      email: 'connexion@example.mg',
      password: 'MotDePasse1',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'connexion@example.mg', password: 'MotDePasse1' });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(registered.email);
  });

  it('refuse un mot de passe incorrect avec un message générique', async () => {
    await registerTestUser(app, { email: 'mauvais@example.mg', password: 'MotDePasse1' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mauvais@example.mg', password: 'MauvaisMotDePasse2' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Identifiants invalides.');
  });

  it('renvoie le même message pour un email inconnu (anti énumération)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@example.mg', password: 'MotDePasse1' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Identifiants invalides.');
  });

  it('refuse un email invalide', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pas-un-email', password: 'MotDePasse1' });

    expect(response.status).toBe(400);
  });
});

describe('GET /api/users/me', () => {
  it('renvoie le profil de l’utilisateur authentifié', async () => {
    const user = await registerTestUser(app);

    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('refuse un accès sans jeton', async () => {
    const response = await request(app).get('/api/users/me');

    expect(response.status).toBe(401);
  });

  it('refuse un jeton invalide', async () => {
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer jeton-invalide');

    expect(response.status).toBe(401);
  });
});

describe('GET /health', () => {
  it('indique que le service est opérationnel', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
