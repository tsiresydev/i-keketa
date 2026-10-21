import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const USER_ROLES = ['user', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Visiteur d'une session de discussion.
 *
 * Aucun compte n'est créé : chaque visite demande un simple nom affiché.
 * Le pseudonyme reste un identifiant technique anonyme (journalisation,
 * signalements) et n'est jamais montré au partenaire.
 */
export interface User {
  _id: Types.ObjectId;
  /** Identifiant technique anonyme, généré par le serveur. */
  pseudonym: string;
  /** Nom affiché choisi par le visiteur à chaque nouvelle session. */
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    pseudonym: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserModel: Model<User> = model<User>('User', userSchema);

export interface PublicUserDto {
  id: string;
  /** Nom affiché choisi par le visiteur : c'est le seul nom visible du partenaire. */
  displayName: string;
  role: UserRole;
  createdAt: Date;
}

/**
 * Projection exposée publiquement : ni email, ni mot de passe, ni identifiant
 * technique anonyme.
 */
export const toPublicUser = (user: User): PublicUserDto => ({
  id: String(user._id),
  displayName: user.displayName,
  role: user.role,
  createdAt: user.createdAt,
});
