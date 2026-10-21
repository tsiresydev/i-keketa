import type { UserDocument } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      /** Utilisateur authentifié, présent après le middleware `authenticate`. */
      user?: UserDocument;
      /** Nom affiché porté par le jeton de session (jamais persisté en base). */
      displayName?: string;
    }
  }
}

export {};
