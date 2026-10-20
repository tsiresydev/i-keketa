import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { rateLimits } from '../src/middleware/rate-limiters';

const app = createApp();

describe('Limitation de débit — routes d’authentification', () => {
  it('bloque les tentatives répétées au-delà de la limite', async () => {
    const previousMax = rateLimits.authMax;
    rateLimits.authMax = 2;

    try {
      const first = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inconnu@example.mg', password: 'MotDePasse1' });
      const second = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inconnu@example.mg', password: 'MotDePasse1' });
      const third = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inconnu@example.mg', password: 'MotDePasse1' });

      expect(first.status).toBe(401);
      expect(second.status).toBe(401);
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('TOO_MANY_REQUESTS');
    } finally {
      rateLimits.authMax = previousMax;
    }
  });
});
