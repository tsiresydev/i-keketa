import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/context/auth-provider';
import { LoginPage } from '../src/pages/LoginPage';
import { ApiRequestError, authApi } from '../src/lib/api-client';

vi.mock('../src/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api-client')>();

  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      login: vi.fn(),
      me: vi.fn(),
      register: vi.fn(),
    },
  };
});

const mockedLogin = vi.mocked(authApi.login);

const renderLoginPage = () =>
  render(
    <MemoryRouter initialEntries={['/connexion']}>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/chat" element={<p>Page de chat</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

describe('Page de connexion', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    window.localStorage.clear();
  });

  it('affiche le formulaire de connexion', async () => {
    renderLoginPage();

    expect(await screen.findByLabelText('Adresse email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('refuse un email invalide sans appeler l’API', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText('Adresse email'), 'pas-un-email');
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse1');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('L’adresse email doit être valide.')).toBeInTheDocument();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('refuse une soumission sans mot de passe', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText('Adresse email'), 'rakoto@example.mg');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Le mot de passe est requis.')).toBeInTheDocument();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('connecte l’utilisateur et accède à la page de chat', async () => {
    const user = userEvent.setup();
    mockedLogin.mockResolvedValue({
      token: 'jeton-de-test',
      user: {
        id: 'user-1',
        email: 'rakoto@example.mg',
        pseudonym: 'Tsara-AB12',
        role: 'user',
        interests: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    renderLoginPage();

    await user.type(await screen.findByLabelText('Adresse email'), 'rakoto@example.mg');
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse1');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith('rakoto@example.mg', 'MotDePasse1');
    });

    expect(await screen.findByText('Page de chat')).toBeInTheDocument();
    expect(window.localStorage.getItem('i-keketa.auth.token')).toBe('jeton-de-test');
  });

  it('affiche le message d’erreur renvoyé par le serveur', async () => {
    const user = userEvent.setup();
    mockedLogin.mockRejectedValue(
      new ApiRequestError(401, 'UNAUTHORIZED', 'Identifiants invalides.'),
    );

    renderLoginPage();

    await user.type(await screen.findByLabelText('Adresse email'), 'rakoto@example.mg');
    await user.type(screen.getByLabelText('Mot de passe'), 'MauvaisMotDePasse1');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument();
  });
});
