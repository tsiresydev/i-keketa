import { useContext } from 'react';
import { ApiRequestError } from '../lib/api-client';
import { AuthContext, type AuthContextValue } from '../context/auth-context';

/**
 * Accès au contexte d'authentification.
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  }

  return context;
};

/**
 * Indique si une erreur provient de l'API (message affichable à l'utilisateur).
 */
export const isAuthError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError;
