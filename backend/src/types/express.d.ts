import type { UserDocument } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      /** Utilisateur authentifié, présent après le middleware `authenticate`. */
      user?: UserDocument;
    }
  }
}

export {};
