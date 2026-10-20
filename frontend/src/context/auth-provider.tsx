import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../lib/api-client';
import { authStorage } from '../lib/auth-storage';
import type { CurrentUser, ProfileUpdatePayload } from '../types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restauration de la session au chargement de l'application.
  useEffect(() => {
    const storedToken = authStorage.getToken();

    if (!storedToken) {
      setStatus('anonymous');
      return;
    }

    let cancelled = false;

    authApi
      .me(storedToken)
      .then(({ user: currentUser }) => {
        if (cancelled) {
          return;
        }

        setToken(storedToken);
        setUser(currentUser);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        authStorage.clearToken();
        setToken(null);
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const establishSession = useCallback((authResponse: { token: string; user: CurrentUser }) => {
    authStorage.setToken(authResponse.token);
    setToken(authResponse.token);
    setUser(authResponse.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const authResponse = await authApi.login(email.trim().toLowerCase(), password);
      establishSession(authResponse);
    },
    [establishSession],
  );

  const register = useCallback(
    async (email: string, password: string, profile?: ProfileUpdatePayload) => {
      const authResponse = await authApi.register(email.trim().toLowerCase(), password, profile);
      establishSession(authResponse);
    },
    [establishSession],
  );

  const logout = useCallback(() => {
    authStorage.clearToken();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const applyUser = useCallback((updatedUser: CurrentUser) => {
    setUser(updatedUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, login, register, logout, applyUser }),
    [status, user, token, login, register, logout, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
