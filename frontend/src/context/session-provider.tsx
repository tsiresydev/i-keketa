import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../lib/api-client';
import { sessionStorage } from '../lib/session-storage';
import type { PublicUser } from '../types';
import { SessionContext, type SessionContextValue, type SessionStatus } from './session-context';

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restauration de la session au chargement de l'application.
  useEffect(() => {
    const storedToken = sessionStorage.getToken();

    if (!storedToken) {
      setStatus('anonymous');
      return;
    }

    let cancelled = false;

    authApi
      .me(storedToken)
      .then(({ user }) => {
        if (cancelled) {
          return;
        }

        setToken(storedToken);
        setUser(user);
        setStatus('active');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        sessionStorage.clearToken();
        setToken(null);
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const establishSession = useCallback((authResponse: { token: string; user: PublicUser }) => {
    sessionStorage.setToken(authResponse.token);
    setToken(authResponse.token);
    setUser(authResponse.user);
    setStatus('active');
  }, []);

  const createSession = useCallback(
    async (displayName: string) => {
      const authResponse = await authApi.session(displayName);
      establishSession(authResponse);
    },
    [establishSession],
  );

  const logout = useCallback(() => {
    sessionStorage.clearToken();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, token, createSession, logout }),
    [status, user, token, createSession, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
