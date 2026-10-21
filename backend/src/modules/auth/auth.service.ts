import { Types } from 'mongoose';
import { UserModel } from '../../models/user.model';
import { signAccessToken } from '../../utils/jwt';
import { generatePseudonym } from '../../utils/text';
import type { SessionInput } from '../../schemas/auth.schema';

export interface SessionResult {
  token: string;
  user: {
    id: string;
    displayName: string;
    role: 'user' | 'moderator' | 'admin';
    createdAt: Date;
  };
}

const createUniquePseudonym = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pseudonym = generatePseudonym();

    if (!(await UserModel.exists({ pseudonym }))) {
      return pseudonym;
    }
  }

  return `Anonyme-${new Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};

/**
 * Ouvre une session de discussion à partir du seul nom affiché saisi par le
 * visiteur : aucun compte, aucun email, aucun mot de passe, et le nom affiché
 * n'est pas persisté — il voyage dans le jeton de session, ce qui permet à
 * plusieurs visiteurs de partager le même nom.
 */
export const createSession = async ({ displayName }: SessionInput): Promise<SessionResult> => {
  const pseudonym = await createUniquePseudonym();

  const user = await UserModel.create({
    pseudonym,
  });

  return {
    token: signAccessToken({ sub: String(user._id), displayName }),
    user: {
      id: String(user._id),
      displayName,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
};

/**
 * Charge un utilisateur depuis son identifiant (utilisé par le middleware
 * d'authentification et par la socket temps réel).
 */
export const findUserById = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  return UserModel.findById(userId);
};
