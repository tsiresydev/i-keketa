import { Types } from 'mongoose';
import { UserModel, toPublicUser, type PublicUserDto } from '../../models/user.model';
import { signAccessToken } from '../../utils/jwt';
import { generatePseudonym } from '../../utils/text';
import type { SessionInput } from '../../schemas/auth.schema';

export interface SessionResult {
  token: string;
  user: PublicUserDto;
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
 * visiteur : aucun compte, aucun email, aucun mot de passe.
 *
 * Le pseudonyme anonyme est généré par le serveur et reste interne ; le
 * partenaire ne voit que le nom affiché choisi par le visiteur.
 */
export const createSession = async ({ displayName }: SessionInput): Promise<SessionResult> => {
  const pseudonym = await createUniquePseudonym();

  const user = await UserModel.create({
    pseudonym,
    displayName,
  });

  return {
    token: signAccessToken({ sub: String(user._id) }),
    user: toPublicUser(user),
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
