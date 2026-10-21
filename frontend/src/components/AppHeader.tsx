import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/use-session';
import type { ConnectionStatus } from '../types';

export interface AppHeaderProps {
  /** Contenu additionnel affiché entre la navigation et l'état de connexion. */
  children?: ReactNode;
  connectionStatus?: ConnectionStatus;
}

/**
 * En-tête commun : identité de l'utilisateur et déconnexion.
 * La navigation a été simplifiée : une seule page de discussion.
 */
export const AppHeader = ({ children, connectionStatus }: AppHeaderProps) => {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = user?.displayName ?? 'Invité';

  const handleLogout = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setIsLoggingOut(true);
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="app-header">
      <Link to="/chat" className="app-header__brand">
        💬 I-Keketa
      </Link>

      {children}

      <div className="app-header__identity">
        <span className="avatar avatar--sm avatar--placeholder" aria-hidden="true">
          {displayName.slice(0, 1).toUpperCase()}
        </span>

        <span className="app-header__identity-text">
          <strong>{displayName}</strong>
          {connectionStatus ? (
            <span className="app-header__status">
              <span
                className={`status-dot ${connectionStatus === 'connected' ? 'status-dot--online' : ''}`}
                aria-hidden="true"
              />
              {connectionStatus === 'connected' ? 'En ligne' : 'Hors ligne'}
            </span>
          ) : null}
        </span>
      </div>

      <form onSubmit={handleLogout} className="app-header__logout">
        <button type="submit" className="button button--ghost" disabled={isLoggingOut}>
          Déconnexion
        </button>
      </form>
    </header>
  );
};
