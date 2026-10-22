import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../hooks/use-session';
import type { ConnectionStatus } from '../types';

export interface AppHeaderProps {
  /** Contenu additionnel affiché entre la navigation et l'état de connexion. */
  children?: ReactNode;
  connectionStatus?: ConnectionStatus;
  onlineCount?: number;
  availableCount?: number;
}

/**
 * En-tête commun : identité de l'utilisateur.
 */
export const AppHeader = ({
  children,
  connectionStatus,
  onlineCount,
  availableCount,
}: AppHeaderProps) => {
  const { user } = useSession();

  const displayName = user?.displayName ?? 'Invité';

  return (
    <header className="app-header">
      <Link to="/chat" className="app-header__brand">
        💬 I-Keketa
      </Link>

      {children}

      <span className="app-header__presence" aria-live="polite">
        {typeof onlineCount === 'number'
          ? `${onlineCount} personne${onlineCount > 1 ? 's' : ''} en ligne`
          : null}
        {typeof availableCount === 'number' && availableCount > 0
          ? ` · ${availableCount} partenaire${availableCount > 1 ? 's' : ''} disponible${availableCount > 1 ? 's' : ''}`
          : null}
      </span>

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
