import { createContext } from 'react';
import type { CurrentUser, ProfileUpdatePayload } from '../types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile?: ProfileUpdatePayload) => Promise<void>;
  logout: () => void;
  /** Met à jour l'utilisateur courant après une modification de profil. */
  applyUser: (user: CurrentUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
