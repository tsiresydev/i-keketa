import { describe, expect, it } from 'vitest';
import { burnPasswordComparison, hashPassword, verifyPassword } from '../../src/utils/password';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

describe('utils/password', () => {
  it('hache le mot de passe et ne conserve pas le texte en clair', async () => {
    const hash = await hashPassword('MotDePasse1');

    expect(hash).not.toBe('MotDePasse1');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('vérifie correctement un mot de passe', async () => {
    const hash = await hashPassword('MotDePasse1');

    await expect(verifyPassword('MotDePasse1', hash)).resolves.toBe(true);
    await expect(verifyPassword('mauvais-mot-de-passe', hash)).resolves.toBe(false);
  });

  it('produit un hash différent à chaque appel (sel aléatoire)', async () => {
    const [first, second] = await Promise.all([
      hashPassword('MotDePasse1'),
      hashPassword('MotDePasse1'),
    ]);

    expect(first).not.toBe(second);
  });

  it('effectue une comparaison factice sans lever d’erreur', async () => {
    await expect(burnPasswordComparison()).resolves.toBeUndefined();
  });
});

describe('utils/jwt', () => {
  it('signe et vérifie un jeton', () => {
    const token = signAccessToken({ sub: 'abc123', email: 'test@example.mg' });
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('abc123');
    expect(payload.email).toBe('test@example.mg');
  });

  it('rejette un jeton falsifié', () => {
    const token = signAccessToken({ sub: 'abc123', email: 'test@example.mg' });
    const tampered = `${token.slice(0, -2)}xx`;

    expect(() => verifyAccessToken(tampered)).toThrowError(/invalide/i);
  });

  it('rejette un jeton invalide', () => {
    expect(() => verifyAccessToken('pas-un-jeton')).toThrowError(/invalide/i);
  });
});
