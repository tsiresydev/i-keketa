import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/use-session';
import type { ConnectionStatus } from '../types';

export interface AppHeaderProps {
  /** Contenu additionnel affiché entre la navigation et l'état de connexion. */
  children?: ReactNode;
  connectionStatus?: ConnectionStatus;
}

/**
 * En-tête commun : identité de l'utilisateur.
 */
export const AppHeader = ({ children, connectionStatus }: AppHeaderProps) => {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  const displayName = user?.displayName ?? 'Invité';

  const handleLogoClick = (): void => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="app-header">
      <button type="button" className="app-header__brand app-header__brand--button" onClick={handleLogoClick}>
        💬 I-Keketa
      </button>

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
    </header>
  );
};
