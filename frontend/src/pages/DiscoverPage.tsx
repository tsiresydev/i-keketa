import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AppHeader } from '../components/AppHeader';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/use-auth';
import { usersApi } from '../lib/api-client';
import { parseInterests } from '../lib/validation';
import type { PublicUser, UserDirectoryResponse } from '../types';

const PAGE_SIZE = 20;

export const DiscoverPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<UserDirectoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!token) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await usersApi.search(token, {
          q: query.trim() || undefined,
          interests: parseInterests(interestInput),
          location: locationInput.trim() || undefined,
          page: targetPage,
          limit: PAGE_SIZE,
        });

        setResults(response);
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : 'Recherche impossible.');
      } finally {
        setIsLoading(false);
      }
    },
    [token, query, interestInput, locationInput],
  );

  // Recherche initiale à l'arrivée sur la page.
  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setNotice(null);
    setPage(1);
    void load(1);
  };

  const handlePageChange = (nextPage: number): void => {
    setPage(nextPage);
    void load(nextPage);
  };

  const startDirectChat = (target: PublicUser): void => {
    setNotice(null);
    navigate(`/chat?user=${encodeURIComponent(target.id)}`);
  };

  const users = results?.users ?? [];
  const totalPages = results?.totalPages ?? 1;

  return (
    <div className="app-shell page">
      <AppHeader />

      <main className="page__main">
        <h1 className="page__title">Découvrir</h1>
        <p className="page__subtitle">
          Recherchez des membres par nom, centres d’intérêt ou localisation, puis lancez une
          discussion directe.
        </p>

        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="notice">{notice}</Alert> : null}

        <section className="card" aria-labelledby="search-section-title">
          <h2 id="search-section-title" className="card__title">
            Rechercher
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Nom ou pseudonyme"
              value={query}
              onChange={setQuery}
              placeholder="Miora"
              disabled={isLoading}
              required={false}
            />

            <FormField
              label="Centres d’intérêt"
              value={interestInput}
              onChange={setInterestInput}
              hint="Séparez-les par des virgules."
              placeholder="musique, voyage"
              disabled={isLoading}
              required={false}
            />

            <FormField
              label="Localisation"
              value={locationInput}
              onChange={setLocationInput}
              placeholder="Antananarivo"
              disabled={isLoading}
              required={false}
            />

            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? 'Recherche…' : 'Rechercher'}
            </button>
          </form>
        </section>

        <section className="card" aria-labelledby="results-section-title">
          <h2 id="results-section-title" className="card__title">
            Résultats
            {results ? <span className="card__counter"> ({results.total})</span> : null}
          </h2>

          {users.length === 0 && !isLoading ? (
            <p className="empty-state">Aucun membre ne correspond à votre recherche.</p>
          ) : null}

          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id} className="user-card">
                {user.photoUrl ? (
                  <img
                    className="avatar avatar--md"
                    src={user.photoUrl}
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  <span className="avatar avatar--md avatar--placeholder" aria-hidden="true">
                    {(user.displayName ?? user.pseudonym).slice(0, 1).toUpperCase()}
                  </span>
                )}

                <div className="user-card__body">
                  <span className="user-card__name">
                    {user.displayName ?? user.pseudonym}
                    {user.displayName ? (
                      <span className="user-card__pseudonym"> ({user.pseudonym})</span>
                    ) : null}
                  </span>

                  {user.location ? (
                    <span className="user-card__meta">📍 {user.location}</span>
                  ) : null}

                  {user.interests.length > 0 ? (
                    <span className="tag-list">
                      {user.interests.map((interest) => (
                        <span key={interest} className="tag">
                          {interest}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="button button--secondary user-card__action"
                  onClick={() => startDirectChat(user)}
                >
                  Discuter
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Pagination des résultats">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                Précédent
              </button>
              <span className="pagination__status">
                Page {page} sur {totalPages}
              </span>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Suivant
              </button>
            </nav>
          ) : null}
        </section>
      </main>
    </div>
  );
};
