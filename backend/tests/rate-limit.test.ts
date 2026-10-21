import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { rateLimits } from '../src/middleware/rate-limiters';

const app = createApp();

describe('Limitation de débit — ouverture de session', () => {
  it('bloque les tentatives répétées au-delà de la limite', async () => {
    const previousMax = rateLimits.authMax;
    rateLimits.authMax = 2;

    try {
      const first = await request(app).post('/api/auth/session').send({ displayName: 'Miora' });
      const second = await request(app).post('/api/auth/session').send({ displayName: 'Rakoto' });
      const third = await request(app).post('/api/auth/session').send({ displayName: 'Tiana' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('TOO_MANY_REQUESTS');
    } finally {
      rateLimits.authMax = previousMax;
    }
  });
});
