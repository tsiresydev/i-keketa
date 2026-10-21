import { useContext } from 'react';
import { ApiRequestError } from '../lib/api-client';
import { SessionContext, type SessionContextValue } from '../context/session-context';

/**
 * Accès au contexte de session.
 */
export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession doit être utilisé dans un SessionProvider.');
  }

  return context;
};

/**
 * Indique si une erreur provient de l'API (message affichable à l'utilisateur).
 */
export const isSessionError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError;
