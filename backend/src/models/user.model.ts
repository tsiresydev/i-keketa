import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const USER_ROLES = ['user', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  pseudonym: string;
  role: UserRole;
  /** Sprint 2 — nom affiché choisi par l'utilisateur. */
  displayName?: string;
  /** Sprint 2 — liste d'intérêts. */
  interests: string[];
  /** Sprint 2 — URL de la photo de profil. */
  photoUrl?: string;
  /** Sprint 2 — localisation utilisée par les filtres de recherche. */
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    pseudonym: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    interests: {
      type: [String],
      default: [],
    },
    photoUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 120,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ interests: 1 });
userSchema.index({ location: 1 });

export const UserModel: Model<User> = model<User>('User', userSchema);

export interface PublicUserDto {
  id: string;
  pseudonym: string;
  role: UserRole;
  /** Présent uniquement si l'utilisateur a explicitement choisi un nom affiché. */
  displayName?: string;
  interests: string[];
  photoUrl?: string;
  location?: string;
  createdAt: Date;
}

export interface PrivateUserDto extends PublicUserDto {
  email: string;
}

/**
 * Projection exposée publiquement : ni email ni hash de mot de passe.
 * Le nom affiché et la photo n'apparaissent que s'ils ont été renseignés
 * (anonymat par défaut).
 */
export const toPublicUser = (user: User): PublicUserDto => ({
  id: String(user._id),
  pseudonym: user.pseudonym,
  role: user.role,
  interests: user.interests,
  ...(user.displayName ? { displayName: user.displayName } : {}),
  ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
  ...(user.location ? { location: user.location } : {}),
  createdAt: user.createdAt,
});

/**
 * Projection exposée au propriétaire de la ressource (email autorisé).
 */
export const toPrivateUser = (user: User): PrivateUserDto => ({
  ...toPublicUser(user),
  email: user.email,
});
