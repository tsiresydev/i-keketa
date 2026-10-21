import { createContext } from 'react';
import type { PublicUser } from '../types';

export type SessionStatus = 'loading' | 'active' | 'anonymous';

export interface SessionContextValue {
  status: SessionStatus;
  user: PublicUser | null;
  token: string | null;
  createSession: (displayName: string) => Promise<void>;
  logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
