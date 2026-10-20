import { Types } from 'mongoose';
import { UserModel, toPrivateUser, type PrivateUserDto } from '../../models/user.model';
import { ApiError } from '../../utils/api-error';
import { burnPasswordComparison, hashPassword, verifyPassword } from '../../utils/password';
import { signAccessToken } from '../../utils/jwt';
import { generatePseudonym } from '../../utils/text';
import type { LoginInput, RegisterInput } from '../../schemas/auth.schema';

export interface AuthResult {
  token: string;
  user: PrivateUserDto;
}

const DUMMY_PSEUDONYM = 'Anonyme-0000';

const createUniquePseudonym = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pseudonym = generatePseudonym();
    const exists = await UserModel.exists({ pseudonym });
    if (!exists) {
      return pseudonym;
    }
  }

  return `${DUMMY_PSEUDONYM}-${new Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};

/**
 * Inscription d'un nouvel utilisateur.
 * - L'email est normalisé en minuscules (unicité garantie par index unique).
 * - Le pseudonyme anonyme est généré par le serveur : l'utilisateur n'expose
 *   ni son email ni son identité à son partenaire de discussion.
 */
export const registerUser = async ({ email, password }: RegisterInput): Promise<AuthResult> => {
  const existingUser = await UserModel.exists({ email });

  if (existingUser) {
    throw ApiError.conflict('Un compte existe déjà avec cette adresse email.');
  }

  const passwordHash = await hashPassword(password);
  const pseudonym = await createUniquePseudonym();

  const user = await UserModel.create({ email, passwordHash, pseudonym });

  return {
    token: signAccessToken({ sub: String(user._id), email: user.email }),
    user: toPrivateUser(user),
  };
};

/**
 * Connexion par email + mot de passe.
 * Le message d'erreur reste identique que l'email existe ou non (anti énumération de comptes).
 */
export const loginUser = async ({ email, password }: LoginInput): Promise<AuthResult> => {
  const user = await UserModel.findOne({ email }).select('+passwordHash');

  if (!user) {
    await burnPasswordComparison();
    throw ApiError.unauthorized('Identifiants invalides.');
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw ApiError.unauthorized('Identifiants invalides.');
  }

  return {
    token: signAccessToken({ sub: String(user._id), email: user.email }),
    user: toPrivateUser(user),
  };
};

/**
 * Charge un utilisateur depuis son identifiant (utilisé par l'authentification).
 */
export const findUserById = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  return UserModel.findById(userId);
};
