import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

describe('utils/jwt', () => {
  it('signe et vérifie un jeton', () => {
    const token = signAccessToken({ sub: 'abc123' });
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('abc123');
  });

  it('rejette un jeton falsifié', () => {
    const token = signAccessToken({ sub: 'abc123' });
    const tampered = `${token.slice(0, -2)}xx`;

    expect(() => verifyAccessToken(tampered)).toThrowError(/invalide/i);
  });

  it('rejette un jeton invalide', () => {
    expect(() => verifyAccessToken('pas-un-jeton')).toThrowError(/invalide/i);
  });
});
