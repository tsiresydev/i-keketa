import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { FormField } from '../components/FormField';
import { isSessionError, useSession } from '../hooks/use-session';
import { validateSessionDisplayName } from '../lib/validation';

export const HomePage = () => {
  const { status, createSession } = useSession();
  const navigate = useNavigate();

  // Demande l'accès à la caméra et au micro dès l'ouverture de la page.
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
        // Permission refusée ou matériel indisponible.
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

  const isMobile =
    typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 767px)')?.matches ?? false);

  if (isMobile) {
    return (
      <div className="home-page">
        <section className="home-page__hero">
          <h1 className="home-page__title">Rencontrez des partenaires en vidéo</h1>
          <p className="home-page__text">
            I-Keketa met en relation des personnes de manière aléatoire pour discuter en vidéo, à
            Madagascar. Entrez un nom affiché, soyez mis en relation avec un autre utilisateur et
            échangez en visio. Aucun compte, aucun mot de passe.
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
            hint="2 à 40 caractères. Ce nom sera vu par la personne avec qui vous discuterez."
          />

          <button type="submit" className="button" disabled={isSubmitting || status === 'loading'}>
            {isSubmitting ? 'Recherche d’un partenaire…' : 'Trouver un partenaire'}
          </button>
        </form>
      </div>
    );
  }

  const scrollToHow = (): void => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="#top" className="landing-nav__brand">
          <span className="landing-nav__logo" aria-hidden="true">💬</span>
          <span className="landing-nav__name">I-Keketa</span>
          <span className="landing-nav__tagline">Rencontres vidéo, simplement</span>
        </a>

        <nav className="landing-nav__links" aria-label="Navigation principale">
          <a href="#top">Accueil</a>
          <a href="#how-it-works">Comment ça marche</a>
          <a href="#about">À propos</a>
        </nav>

        <a href="#start" className="button landing-nav__cta">
          Commencer
        </a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__blob hero__blob--1" aria-hidden="true" />
          <div className="hero__blob hero__blob--2" aria-hidden="true" />

          <div className="hero__content">
            <span className="hero__badge">Le chat vidéo aléatoire, autrement</span>

            <h1 className="hero__title">
              Une rencontre. <span className="hero__gradient">Une connexion.</span> Une nouvelle
              histoire.
            </h1>

            <p className="hero__text">
              Découvre I-Keketa, la plateforme de chat vidéo qui te permet de rencontrer de
              nouvelles personnes à Madagascar. Lance la recherche et laisse la magie de la rencontre
              opérer.
            </p>

            <div className="hero__actions" id="start">
              <form onSubmit={handleSubmit} className="hero__form" noValidate>
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

                <button
                  type="submit"
                  className="button hero__primary"
                  disabled={isSubmitting || status === 'loading'}
                >
                  {isSubmitting ? 'Recherche d’un partenaire…' : 'Trouver un partenaire'}
                </button>
              </form>

              <button type="button" className="button button--secondary hero__secondary" onClick={scrollToHow}>
                Comment ça marche
              </button>
            </div>

            <ul className="hero__features">
              <li>
                <span className="hero__feature-icon" aria-hidden="true">⚡</span>
                Simple et rapide
              </li>
              <li>
                <span className="hero__feature-icon" aria-hidden="true">📹</span>
                Rencontre en vidéo
              </li>
              <li>
                <span className="hero__feature-icon" aria-hidden="true">🤝</span>
                Connexion avec de nouvelles personnes
              </li>
            </ul>
          </div>

          <div className="hero__visual" aria-hidden="true">
            <div className="hero__card hero__card--main">
              <div className="hero__card-header">
                <span className="hero__card-dot" />
                <span className="hero__card-name">Nadia</span>
              </div>
              <div className="hero__card-body">
                <div className="hero__avatar hero__avatar--lg">N</div>
                <div className="hero__card-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="hero__card-controls">
                <span className="hero__card-btn">🎤</span>
                <span className="hero__card-btn">📹</span>
                <span className="hero__card-btn hero__card-btn--hangup">📞</span>
              </div>
            </div>

            <div className="hero__card hero__card--local">
              <div className="hero__avatar hero__avatar--sm">A</div>
              <span className="hero__card-local-label">Vous</span>
            </div>

            <div className="hero__profile hero__profile--1">
              <span className="hero__profile-avatar">M</span>
              <span>En ligne</span>
            </div>
            <div className="hero__profile hero__profile--2">
              <span className="hero__profile-avatar">T</span>
              <span>Disponible</span>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section">
          <div className="section__header">
            <span className="section__eyebrow">Comment ça marche</span>
            <h2 className="section__title">Trois étapes pour une nouvelle rencontre</h2>
          </div>

          <div className="steps">
            <article className="step-card">
              <span className="step-card__number">01</span>
              <h3 className="step-card__title">Présente-toi</h3>
              <p className="step-card__text">Entre le nom que tu souhaites afficher.</p>
            </article>
            <article className="step-card">
              <span className="step-card__number">02</span>
              <h3 className="step-card__title">Lance la recherche</h3>
              <p className="step-card__text">
                Clique sur le bouton pour rechercher un partenaire disponible.
              </p>
            </article>
            <article className="step-card">
              <span className="step-card__number">03</span>
              <h3 className="step-card__title">Fais une nouvelle rencontre</h3>
              <p className="step-card__text">
                Échange en vidéo et passe à une autre personne lorsque tu le souhaites.
              </p>
            </article>
          </div>
        </section>

        <section id="about" className="section section--alt">
          <div className="section__header">
            <span className="section__eyebrow">Pourquoi I-Keketa ?</span>
            <h2 className="section__title">Une expérience pensée pour la simplicité</h2>
          </div>

          <div className="benefits">
            <article className="benefit-card">
              <span className="benefit-card__icon" aria-hidden="true">✨</span>
              <h3>Simple</h3>
              <p>Un parcours de démarrage rapide et intuitif.</p>
            </article>
            <article className="benefit-card">
              <span className="benefit-card__icon" aria-hidden="true">🎲</span>
              <h3>Spontané</h3>
              <p>Découvre de nouvelles personnes grâce à la mise en relation aléatoire.</p>
            </article>
            <article className="benefit-card">
              <span className="benefit-card__icon" aria-hidden="true">🎥</span>
              <h3>Interactif</h3>
              <p>Communique en direct par vidéo.</p>
            </article>
            <article className="benefit-card">
              <span className="benefit-card__icon" aria-hidden="true">📱</span>
              <h3>Accessible</h3>
              <p>Profite d'une interface adaptée aux ordinateurs et aux smartphones.</p>
            </article>
          </div>
        </section>

        <section className="section section--reassure">
          <div className="reassure">
            <h2 className="reassure__title">De belles rencontres commencent dans le respect.</h2>
            <p className="reassure__text">
              Échange avec bienveillance, respecte les autres participants et protège tes
              informations personnelles.
            </p>
            <div className="reassure__badges">
              <span>Respect</span>
              <span>Confidentialité</span>
              <span>Bienveillance</span>
            </div>
          </div>
        </section>

        <section className="cta-final">
          <div className="cta-final__blob" aria-hidden="true" />
          <h2 className="cta-final__title">Prêt à faire une nouvelle rencontre ?</h2>
          <p className="cta-final__text">Quelques secondes suffisent pour commencer.</p>
          <a href="#start" className="button cta-final__button">
            Commencer maintenant
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <strong>I-Keketa</strong>
          <p>Rencontres vidéo, simplement.</p>
        </div>
        <nav className="landing-footer__links" aria-label="Liens du pied de page">
          <a href="#top">Accueil</a>
          <a href="#how-it-works">Comment ça marche</a>
          <a href="#about">À propos</a>
        </nav>
        <p className="landing-footer__copy">© {new Date().getFullYear()} I-Keketa</p>
      </footer>
    </div>
  );
};