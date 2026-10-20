import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/context/auth-provider';
import { ProfilePage } from '../src/pages/ProfilePage';
import { ApiRequestError, authApi, profileApi } from '../src/lib/api-client';
import type { CurrentUser } from '../src/types';

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
    profileApi: {
      ...actual.profileApi,
      update: vi.fn(),
      uploadPhoto: vi.fn(),
      deletePhoto: vi.fn(),
    },
  };
});

const mockedMe = vi.mocked(authApi.me);
const mockedUpdate = vi.mocked(profileApi.update);
const mockedUploadPhoto = vi.mocked(profileApi.uploadPhoto);
const mockedDeletePhoto = vi.mocked(profileApi.deletePhoto);

const baseUser: CurrentUser = {
  id: 'user-1',
  email: 'rakoto@example.mg',
  pseudonym: 'Tsara-AB12',
  role: 'user',
  interests: ['musique'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const renderProfilePage = () =>
  render(
    <MemoryRouter initialEntries={['/profil']}>
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    </MemoryRouter>,
  );

/** Attend la restauration de la session (l'utilisateur courant est chargé). */
const waitForSession = async (): Promise<void> => {
  await screen.findByText('Tsara-AB12');
};

describe('Page de profil', () => {
  beforeEach(() => {
    mockedMe.mockReset();
    mockedUpdate.mockReset();
    mockedUploadPhoto.mockReset();
    mockedDeletePhoto.mockReset();

    mockedMe.mockResolvedValue({ user: baseUser });
    window.localStorage.setItem('i-keketa.auth.token', 'jeton-de-test');
  });

  it('affiche les informations du profil courant', async () => {
    renderProfilePage();

    await waitForSession();

    expect(await screen.findByLabelText('Nom affiché')).toBeInTheDocument();
    expect(screen.getByLabelText('Centres d’intérêt')).toHaveValue('musique');
    expect(
      screen.getByRole('button', { name: 'Enregistrer les modifications' }),
    ).toBeInTheDocument();
  });

  it('enregistre le profil modifié', async () => {
    const user = userEvent.setup();
    mockedUpdate.mockResolvedValue({
      user: {
        ...baseUser,
        displayName: 'Miora',
        interests: ['musique', 'voyage'],
        location: 'Antananarivo',
      },
    });

    renderProfilePage();

    const nameField = await screen.findByLabelText('Nom affiché');
    await user.clear(nameField);
    await user.type(nameField, 'Miora');

    const interestsField = screen.getByLabelText('Centres d’intérêt');
    await user.clear(interestsField);
    await user.type(interestsField, 'musique, voyage');

    const locationField = screen.getByLabelText('Localisation');
    await user.type(locationField, 'Antananarivo');

    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith('jeton-de-test', {
        displayName: 'Miora',
        interests: ['musique', 'voyage'],
        location: 'Antananarivo',
      });
    });

    expect(await screen.findByText('Profil mis à jour.')).toBeInTheDocument();
  });

  it('refuse un nom trop court sans appeler l’API', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    const nameField = await screen.findByLabelText('Nom affiché');
    await user.clear(nameField);
    await user.type(nameField, 'M');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(
      await screen.findByText('Le nom doit contenir au moins 2 caractères.'),
    ).toBeInTheDocument();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('affiche le message d’erreur renvoyé par le serveur', async () => {
    const user = userEvent.setup();
    mockedUpdate.mockRejectedValue(new ApiRequestError(400, 'BAD_REQUEST', 'Données invalides.'));

    renderProfilePage();

    await user.click(await screen.findByRole('button', { name: 'Enregistrer les modifications' }));

    expect(await screen.findByText('Données invalides.')).toBeInTheDocument();
  });

  it('envoie une photo de profil valide', async () => {
    mockedUploadPhoto.mockResolvedValue({
      user: { ...baseUser, photoUrl: '/uploads/photos/profil.png' },
    });

    renderProfilePage();
    await waitForSession();

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'profil.png', {
      type: 'image/png',
    });

    const input = document.getElementById('photo-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedUploadPhoto).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Photo de profil mise à jour.')).toBeInTheDocument();
  });

  it('refuse une photo dont le format n’est pas autorisé', async () => {
    renderProfilePage();
    await waitForSession();

    const file = new File(['contenu'], 'profil.txt', { type: 'text/plain' });
    const input = document.getElementById('photo-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText('Format d’image non accepté. Formats autorisés : JPEG, PNG et WebP.'),
    ).toBeInTheDocument();
    expect(mockedUploadPhoto).not.toHaveBeenCalled();
  });

  it('supprime la photo de profil', async () => {
    const user = userEvent.setup();
    mockedMe.mockResolvedValue({
      user: { ...baseUser, photoUrl: '/uploads/photos/profil.png' },
    });
    mockedDeletePhoto.mockResolvedValue({ user: baseUser });

    renderProfilePage();

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(mockedDeletePhoto).toHaveBeenCalledWith('jeton-de-test');
    });

    expect(await screen.findByText('Photo de profil supprimée.')).toBeInTheDocument();
  });
});
