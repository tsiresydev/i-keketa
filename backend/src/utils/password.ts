import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/**
 * Hachage du mot de passe (bcrypt).
 */
export const hashPassword = async (plainPassword: string): Promise<string> =>
  bcrypt.hash(plainPassword, env.BCRYPT_SALT_ROUNDS);

/**
 * Comparaison à temps constant d'un mot de passe avec son hash.
 */
export const verifyPassword = async (
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> => bcrypt.compare(plainPassword, passwordHash);

/**
 * Hash factice utilisé quand aucun compte ne correspond à l'email fourni.
 * Il permet d'égaliser le temps de réponse et d'éviter l'énumération de comptes.
 */
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export const burnPasswordComparison = async (): Promise<void> => {
  await bcrypt.compare('dummy-password', DUMMY_PASSWORD_HASH);
};
