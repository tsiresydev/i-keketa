import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { AuthProvider } from '../src/context/auth-provider';
import { ChatPage } from '../src/pages/ChatPage';

interface EmittedEvent {
  event: string;
  payload?: unknown;
}

const { fakeSocket } = vi.hoisted(() => {
  class FakeSocket {
    connected = true;
    readonly emitted: EmittedEvent[] = [];
    private readonly listeners = new Map<string, Set<(payload?: unknown) => void>>();

    on(event: string, listener: (payload?: unknown) => void): this {
      const set = this.listeners.get(event) ?? new Set();
      set.add(listener);
      this.listeners.set(event, set);
      return this;
    }

    off(event: string, listener: (payload?: unknown) => void): this {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    removeAllListeners(): this {
      this.listeners.clear();
      return this;
    }

    listenerCount(event: string): number {
      return this.listeners.get(event)?.size ?? 0;
    }

    emit(event: string, ...args: unknown[]): boolean {
      this.emitted.push({ event, payload: args[0] });
      this.listeners.get(event)?.forEach((listener) => listener(args[0]));
      return true;
    }

    disconnect(): void {
      this.connected = false;
    }
  }

  return { fakeSocket: new FakeSocket() };
});

vi.mock('../src/lib/socket-client', () => ({
  createChatSocket: () => fakeSocket as unknown as Socket,
}));

vi.mock('../src/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api-client')>();

  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      me: vi.fn().mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'rakoto@example.mg',
          pseudonym: 'Tsara-AB12',
          role: 'user',
          interests: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    },
  };
});

/** Émet un événement temps réel en enveloppant la mise à jour React dans `act`. */
const emit = async (event: string, payload?: unknown): Promise<void> => {
  await act(async () => {
    fakeSocket.emit(event, payload);
  });
};

const renderChatPage = async (initialEntry = '/chat') => {
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <ChatPage />
      </AuthProvider>
    </MemoryRouter>,
  );

  // La connexion temps réel n’est ouverte qu’une fois la session restaurée.
  await waitFor(() => {
    expect(fakeSocket.listenerCount('connect')).toBeGreaterThan(0);
  });

  await emit('connect');

  return view;
};

describe('Page de chat', () => {
  beforeEach(() => {
    fakeSocket.removeAllListeners();
    fakeSocket.emitted.length = 0;
    fakeSocket.connected = true;
    window.localStorage.setItem('i-keketa.auth.token', 'jeton-de-test');
  });

  it('propose de trouver un partenaire au démarrage', async () => {
    await renderChatPage();

    expect(await screen.findByRole('button', { name: 'Trouver quelqu’un' })).toBeInTheDocument();
  });

  it('rejoint la file d’attente et affiche l’état d’attente', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'queue:join')).toBe(true);
    });

    await emit('queue:status', { status: 'waiting', position: 1 });

    expect(await screen.findByText('Recherche d’un partenaire…')).toBeInTheDocument();
  });

  it('affiche le partenaire et permet d’envoyer un message', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));

    await emit('match:found', { matchId: 'match-1', partner: { pseudonym: 'Mety-CD34' } });

    expect(await screen.findByText('Mety-CD34')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Votre message'), 'Salut !');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      const sent = fakeSocket.emitted.find((entry) => entry.event === 'chat:message');
      expect(sent?.payload).toEqual({ matchId: 'match-1', content: 'Salut !' });
    });
  });

  it('affiche les messages reçus en temps réel', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));
    await emit('match:found', { matchId: 'match-1', partner: { pseudonym: 'Mety-CD34' } });

    await emit('chat:message', {
      message: {
        id: 'message-1',
        matchId: 'match-1',
        senderId: 'user-2',
        content: 'Bonjour à toi !',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    });

    expect(await screen.findByText('Bonjour à toi !')).toBeInTheDocument();
  });

  it('affiche un message d’erreur renvoyé par le serveur', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));

    await emit('chat:error', {
      code: 'RATE_LIMITED',
      message: 'Vous envoyez des messages trop rapidement.',
    });

    expect(
      await screen.findByText('Vous envoyez des messages trop rapidement.'),
    ).toBeInTheDocument();
  });

  it('permet de passer à un autre partenaire', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));
    await emit('match:found', { matchId: 'match-1', partner: { pseudonym: 'Mety-CD34' } });

    await user.click(screen.getByRole('button', { name: 'Passer à quelqu’un d’autre' }));

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'chat:skip')).toBe(true);
    });
  });

  it('démarre une discussion directe depuis le paramètre d’URL', async () => {
    await renderChatPage('/chat?user=user-2');

    await waitFor(() => {
      const started = fakeSocket.emitted.find((entry) => entry.event === 'chat:start');
      expect(started?.payload).toEqual({ userId: 'user-2' });
    });
  });

  it('affiche le nom affiché du partenaire quand il est renseigné', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));
    await emit('match:found', {
      matchId: 'match-1',
      partner: { pseudonym: 'Mety-CD34', displayName: 'Miora', photoUrl: '/uploads/photos/a.png' },
    });

    expect(await screen.findByText('Miora')).toBeInTheDocument();
    expect(screen.getByText('(Mety-CD34)')).toBeInTheDocument();
  });

  it('affiche l’erreur si la cible n’est pas disponible', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver quelqu’un' }));

    await emit('chat:error', {
      code: 'USER_UNAVAILABLE',
      message: 'Cet utilisateur n’est pas connecté actuellement.',
    });

    expect(
      await screen.findByText('Cet utilisateur n’est pas connecté actuellement.'),
    ).toBeInTheDocument();
  });
});
