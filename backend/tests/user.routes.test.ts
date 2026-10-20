import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { registerTestUser } from './helpers/test-context';

const app = createApp();

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

/** Fichier PNG minimal (signature valide + charge utile). */
const buildPng = (size = 1024): Buffer => Buffer.concat([PNG_HEADER, Buffer.alloc(size, 1)]);

const uploadsDirectory = path.resolve(process.cwd(), 'uploads');

describe('API utilisateurs — profil, photo et recherche', () => {
  beforeEach(() => {
    // Les fichiers de photo sont propres à chaque test.
  });

  afterAll(async () => {
    await fs.rm(uploadsDirectory, { recursive: true, force: true });
  });

  it('met à jour le profil (nom, intérêts, localisation)', async () => {
    const user = await registerTestUser(app);

    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        displayName: 'Miora',
        interests: ['musique', 'Musique', 'voyage'],
        location: 'Antananarivo',
      });

    expect(response.status).toBe(200);
    expect(response.body.user.displayName).toBe('Miora');
    expect(response.body.user.interests).toEqual(['musique', 'voyage']);
    expect(response.body.user.location).toBe('Antananarivo');
  });

  it('refuse une mise à jour de profil invalide', async () => {
    const user = await registerTestUser(app);

    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ displayName: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('exige une authentification pour modifier le profil', async () => {
    const response = await request(app).put('/api/users/me').send({ displayName: 'Miora' });

    expect(response.status).toBe(401);
  });

  it('accepte une photo PNG valide et la sert sur /uploads', async () => {
    const user = await registerTestUser(app);

    const response = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('photo', buildPng(), { filename: 'profil.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.user.photoUrl).toMatch(/^\/uploads\/photos\//);

    const served = await request(app).get(response.body.user.photoUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/image\/png/);
  });

  it('accepte les formats JPEG et WebP', async () => {
    const jpegUser = await registerTestUser(app);
    const webpUser = await registerTestUser(app);

    const jpeg = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${jpegUser.token}`)
      .attach('photo', Buffer.concat([JPEG_HEADER, Buffer.alloc(512, 2)]), {
        filename: 'profil.jpg',
        contentType: 'image/jpeg',
      });

    const webp = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${webpUser.token}`)
      .attach('photo', Buffer.concat([WEBP_HEADER, Buffer.alloc(512, 3)]), {
        filename: 'profil.webp',
        contentType: 'image/webp',
      });

    expect(jpeg.status).toBe(200);
    expect(jpeg.body.user.photoUrl).toMatch(/\.jpg$/);
    expect(webp.status).toBe(200);
    expect(webp.body.user.photoUrl).toMatch(/\.webp$/);
  });

  it('refuse un type de fichier non autorisé', async () => {
    const user = await registerTestUser(app);

    const response = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('photo', Buffer.from('contenu texte'), {
        filename: 'profil.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
  });

  it('refuse un fichier dont le contenu ne correspond pas au type déclaré', async () => {
    const user = await registerTestUser(app);

    const response = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('photo', Buffer.from('ceci nest pas une image'), {
        filename: 'profil.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/Format d’image non accepté/);
  });

  it('refuse une photo trop volumineuse', async () => {
    const user = await registerTestUser(app);

    const oversized = Buffer.concat([PNG_HEADER, Buffer.alloc(2 * 1024 * 1024 + 1024, 4)]);

    const response = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('photo', oversized, { filename: 'gros.png', contentType: 'image/png' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/2 Mo/);
  });

  it('supprime la photo de profil', async () => {
    const user = await registerTestUser(app);

    const upload = await request(app)
      .post('/api/users/me/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('photo', buildPng(), { filename: 'profil.png', contentType: 'image/png' });

    const photoUrl = upload.body.user.photoUrl as string;

    const response = await request(app)
      .delete('/api/users/me/photo')
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.photoUrl).toBeUndefined();

    const served = await request(app).get(photoUrl);
    expect(served.status).toBe(404);
  });

  it('liste les autres utilisateurs et exclut l’utilisateur courant', async () => {
    const alice = await registerTestUser(app, { displayName: 'Miora' });
    await registerTestUser(app, { displayName: 'Fara' });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].displayName).toBe('Fara');
    expect(response.body.users[0].id).not.toBe(alice.userId);
  });

  it('filtre les utilisateurs par centres d’intérêt', async () => {
    const alice = await registerTestUser(app);
    await registerTestUser(app, { interests: ['musique', 'voyage'] });
    await registerTestUser(app, { interests: ['cuisine'] });

    const response = await request(app)
      .get('/api/users')
      .query({ interests: 'musique' })
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].interests).toContain('musique');
  });

  it('filtre les utilisateurs par localisation', async () => {
    const alice = await registerTestUser(app);
    await registerTestUser(app, { location: 'Antananarivo' });
    await registerTestUser(app, { location: 'Toamasina' });

    const response = await request(app)
      .get('/api/users')
      .query({ location: 'toamasina' })
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].location).toBe('Toamasina');
  });

  it('filtre les utilisateurs par recherche textuelle', async () => {
    const alice = await registerTestUser(app);
    await registerTestUser(app, { displayName: 'Miora Rakoto' });

    const response = await request(app)
      .get('/api/users')
      .query({ q: 'rakoto' })
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.users[0].displayName).toBe('Miora Rakoto');
  });

  it('limite la taille de page à 50 éléments', async () => {
    const alice = await registerTestUser(app);

    const response = await request(app)
      .get('/api/users')
      .query({ limit: 500 })
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('exige une authentification pour rechercher des utilisateurs', async () => {
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(401);
  });

  it('enregistre le profil renseigné à l’inscription', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: `inscription-${Date.now()}@example.mg`,
        password: 'MotDePasse1',
        displayName: 'Miora',
        interests: ['musique'],
        location: 'Fianarantsoa',
      });

    expect(response.status).toBe(201);
    expect(response.body.user.displayName).toBe('Miora');
    expect(response.body.user.interests).toEqual(['musique']);
    expect(response.body.user.location).toBe('Fianarantsoa');
  });
});
