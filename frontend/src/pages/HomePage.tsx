import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { FormField } from '../components/FormField';
import { isSessionError, useSession } from '../hooks/use-session';
import { validateSessionDisplayName } from '../lib/validation';

/**
 * Page d'accueil : saisir son nom affiché puis rejoindre la file d'attente
 * pour être mis en relation avec un autre visiteur. Aucune inscription,
 * aucun mot de passe, aucune adresse email.
 */
export const HomePage = () => {
  const { status, createSession } = useSession();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      navigate('/chat', { replace: true });
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
        <h1 className="home-page__title">Discutez en vidéo anonyme</h1>
        <p className="home-page__text">
          Entrez un nom affiché, soyez mis en relation avec une autre personne et échangez en vidéo.
          Aucun compte, aucun mot de passe.
        </p>
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
          hint="2 à 40 caractères. Ce nom sera vu par votre partenaire."
        />

        <button type="submit" className="button" disabled={isSubmitting || status === 'loading'}>
          {isSubmitting ? 'Création de la session…' : 'Créer une session'}
        </button>
      </form>

      <p className="home-page__footer">
        <Link to="/chat">Déjà une session active ? Revenir à la discussion</Link>
      </p>
    </div>
  );
};
