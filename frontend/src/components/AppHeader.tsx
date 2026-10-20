import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import type { ConnectionStatus } from '../types';

export interface AppHeaderProps {
  /** Contenu additionnel affiché entre la navigation et l'état de connexion. */
  children?: ReactNode;
  connectionStatus?: ConnectionStatus;
}

/**
 * En-tête commun : navigation, identité de l'utilisateur et déconnexion.
 */
export const AppHeader = ({ children, connectionStatus }: AppHeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = user?.displayName ?? user?.pseudonym ?? 'Invité';

  const handleLogout = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setIsLoggingOut(true);
    logout();
    navigate('/connexion', { replace: true });
  };

  return (
    <header className="app-header">
      <Link to="/chat" className="app-header__brand">
        💬 I-Keketa
      </Link>

      <nav className="app-header__nav" aria-label="Navigation principale">
        <NavLink
          to="/chat"
          className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}
        >
          Discussion
        </NavLink>
        <NavLink
          to="/decouvrir"
          className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}
        >
          Découvrir
        </NavLink>
        <NavLink
          to="/profil"
          className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}
        >
          Mon profil
        </NavLink>
      </nav>

      {children}

      <div className="app-header__identity">
        {user?.photoUrl ? (
          <img className="avatar avatar--sm" src={user.photoUrl} alt="" aria-hidden="true" />
        ) : (
          <span className="avatar avatar--sm avatar--placeholder" aria-hidden="true">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}

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
