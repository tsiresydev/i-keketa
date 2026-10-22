import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { FormField } from '../components/FormField';
import { isSessionError, useSession } from '../hooks/use-session';
import { API_BASE_URL } from '../lib/api-client';
import { validateSessionDisplayName } from '../lib/validation';

/**
 * Page d'accueil : saisir son nom affiché puis rejoindre la file d'attente
 * pour être mis en relation avec un autre visiteur. Aucune inscription,
 * aucun mot de passe, aucune adresse email.
 */
export const HomePage = () => {
  const { status, createSession } = useSession();
  const navigate = useNavigate();

  // Demande l'accès à la caméra et au micro dès l'ouverture de la page,
  // afin que la permission soit déjà accordée lors du lancement de l'appel.
  useEffect(() => {
    let cancelled = false;

    const requestMedia = async (): Promise<void> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // Permission refusée ou matériel indisponible : on laisse l'utilisateur
        // continuer, l'appel demandera à nouveau l'accès le moment venu.
      }
    };

    void requestMedia();

    return () => {
      cancelled = true;
    };
  }, []);

  const [displayName, setDisplayName] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [availableCount, setAvailableCount] = useState<number | null>(null);

  // Interroge le compteur d'utilisateurs en ligne (la page d'accueil n'a pas
  // de socket temps réel).
  useEffect(() => {
    let cancelled = false;

    const fetchPresence = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/presence`);

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { online: number; available: number };

        if (cancelled) {
          return;
        }

        setOnlineCount(data.online);
        setAvailableCount(data.available);
      } catch {
        // Réseau indisponible : on garde la dernière valeur connue.
      }
    };

    void fetchPresence();
    const interval = window.setInterval(() => void fetchPresence(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFieldError(undefined);
    setFormError(null);

    const validationError = validateSessionDisplayName(displayName);

    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await createSession(displayName);
      navigate('/chat', { replace: true, state: { autoSearch: true } });
    } catch (error) {
      setFormError(
        isSessionError(error) ? error.message : 'Impossible de créer la session. Réessayez.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="home-page">
      <section className="home-page__hero">
        <h1 className="home-page__title">Rencontrez des partenaires en vidéo</h1>
        <p className="home-page__text">
          I-Keketa met en relation des personnes de manière aléatoire pour discuter en vidéo, à
          Madagascar. Entrez un nom affiché, soyez mis en relation avec un autre utilisateur et
          échangez en visio. Aucun compte, aucun mot de passe. L'accès à la caméra et au micro vous
          sera demandé à l'ouverture.
        </p>
        {onlineCount !== null ? (
          <p className="home-page__presence" aria-live="polite">
            {onlineCount} personne{onlineCount > 1 ? 's' : ''} en ligne
            {availableCount !== null && availableCount > 0
              ? ` · ${availableCount} partenaire${availableCount > 1 ? 's' : ''} disponible${availableCount > 1 ? 's' : ''}`
              : null}
          </p>
        ) : null}
      </section>

      <form onSubmit={handleSubmit} className="home-page__form" noValidate>
        {formError ? <Alert variant="error">{formError}</Alert> : null}

        <FormField
          label="Nom affiché"
          value={displayName}
          onChange={setDisplayName}
          error={fieldError}
          placeholder="Ex. Alex"
          disabled={isSubmitting || status === 'loading'}
          autoComplete="nickname"
          maxLength={40}
          hint="2 à 40 caractères. Ce nom sera vu par la personne avec qui vous discuterez."
        />

        <button type="submit" className="button" disabled={isSubmitting || status === 'loading'}>
          {isSubmitting ? 'Recherche d’un partenaire…' : 'Trouver un partenaire'}
        </button>
      </form>

      <p className="home-page__footer">
        <Link to="/chat">Déjà une session active ? Revenir à la discussion</Link>
      </p>
    </div>
  );
};
