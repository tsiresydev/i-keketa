import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

const FullScreenLoader = () => (
  <div className="fullscreen-loader" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true" />
    <p>Chargement…</p>
  </div>
);

/**
 * Restreint l'accès aux routes nécessitant une session active.
 */
export const ProtectedRoute = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
