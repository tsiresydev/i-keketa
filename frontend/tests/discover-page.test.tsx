import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/context/auth-provider';
import { DiscoverPage } from '../src/pages/DiscoverPage';
import { authApi, usersApi } from '../src/lib/api-client';
import type { UserDirectoryResponse } from '../src/types';

vi.mock('../src/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api-client')>();

  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
    },
    usersApi: {
      ...actual.usersApi,
      search: vi.fn(),
    },
  };
});

const mockedMe = vi.mocked(authApi.me);
const mockedSearch = vi.mocked(usersApi.search);

const emptyDirectory: UserDirectoryResponse = {
  users: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const directory: UserDirectoryResponse = {
  users: [
    {
      id: 'user-2',
      pseudonym: 'Mety-CD34',
      displayName: 'Miora',
      role: 'user',
      interests: ['musique', 'voyage'],
      location: 'Antananarivo',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'user-3',
      pseudonym: 'Tsara-AB12',
      role: 'user',
      interests: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
};

/** Route simulant la page de chat, affichant la cible d'une discussion directe. */
const ChatTarget = () => {
  const [searchParams] = useSearchParams();
  return <p>Page de chat : {searchParams.get('user') ?? 'aucune cible'}</p>;
};

const renderDiscoverPage = () =>
  render(
    <MemoryRouter initialEntries={['/decouvrir']}>
      <AuthProvider>
        <Routes>
          <Route path="/decouvrir" element={<DiscoverPage />} />
          <Route path="/chat" element={<ChatTarget />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

describe('Page de découverte', () => {
  beforeEach(() => {
    mockedMe.mockReset();
    mockedSearch.mockReset();

    mockedMe.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'rakoto@example.mg',
        pseudonym: 'Curieux-A1B2',
        role: 'user',
        interests: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    mockedSearch.mockResolvedValue(emptyDirectory);
    window.localStorage.setItem('i-keketa.auth.token', 'jeton-de-test');
  });

  it('liste les utilisateurs trouvés', async () => {
    mockedSearch.mockResolvedValue(directory);

    renderDiscoverPage();

    expect(await screen.findByText('Miora')).toBeInTheDocument();
    expect(screen.getByText('(Mety-CD34)')).toBeInTheDocument();
    expect(screen.getByText('📍 Antananarivo')).toBeInTheDocument();
    expect(screen.getByText('musique')).toBeInTheDocument();
  });

  it('affiche le pseudonyme quand aucun nom n’est renseigné', async () => {
    mockedSearch.mockResolvedValue(directory);

    renderDiscoverPage();

    expect(await screen.findByText('Tsara-AB12')).toBeInTheDocument();
  });

  it('indique qu’aucun résultat ne correspond', async () => {
    renderDiscoverPage();

    expect(
      await screen.findByText('Aucun membre ne correspond à votre recherche.'),
    ).toBeInTheDocument();
  });

  it('transmet les filtres de recherche à l’API', async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue(directory);

    renderDiscoverPage();

    await screen.findByText('Miora');

    await user.type(screen.getByLabelText('Nom ou pseudonyme'), 'miora');
    await user.type(screen.getByLabelText('Centres d’intérêt'), 'musique, voyage');
    await user.type(screen.getByLabelText('Localisation'), 'Antananarivo');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenLastCalledWith('jeton-de-test', {
        q: 'miora',
        interests: ['musique', 'voyage'],
        location: 'Antananarivo',
        page: 1,
        limit: 20,
      });
    });
  });

  it('lance une discussion directe avec l’utilisateur choisi', async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue(directory);

    renderDiscoverPage();

    const buttons = await screen.findAllByRole('button', { name: 'Discuter' });
    await user.click(buttons[0] as HTMLElement);

    expect(await screen.findByText('Page de chat : user-2')).toBeInTheDocument();
  });
});
