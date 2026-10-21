import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { SessionProvider } from '../src/context/session-provider';
import { ChatPage } from '../src/pages/ChatPage';

interface EmittedEvent {
  event: string;
  payload?: unknown;
}

const { fakeSocket, getUserMediaMock } = vi.hoisted(() => {
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
      return true;
    }

    /** Émission du serveur vers ce client. */
    deliver(event: string, payload?: unknown): void {
      this.listeners.get(event)?.forEach((listener) => listener(payload));
    }

    disconnect(): void {
      this.connected = false;
    }
  }

  const getUserMediaMock = vi.fn(async () => ({
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  }));

  return { fakeSocket: new FakeSocket(), getUserMediaMock };
});

/**
 * Fausse implémentation de `RTCPeerConnection` : jsdom ne fournit pas
 * l'API WebRTC.
 */
class FakePeerConnection {
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = 'new';
  localDescription: unknown = null;
  remoteDescription: unknown = null;

  addTrack(): void {}

  createOffer(): Promise<unknown> {
    return Promise.resolve({ type: 'offer', sdp: 'v=0' });
  }

  createAnswer(): Promise<unknown> {
    return Promise.resolve({ type: 'answer', sdp: 'v=0' });
  }

  setLocalDescription(description: unknown): Promise<void> {
    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription(description: unknown): Promise<void> {
    this.remoteDescription = description;
    return Promise.resolve();
  }

  addIceCandidate(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {}
}

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
          displayName: 'Rakoto',
          role: 'user',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    },
  };
});

/** Simule une émission du serveur vers le client. */
const emit = async (event: string, payload?: unknown): Promise<void> => {
  await act(async () => {
    fakeSocket.deliver(event, payload);
  });
};

const renderChatPage = async (initialEntry = '/chat') => {
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SessionProvider>
        <ChatPage />
      </SessionProvider>
    </MemoryRouter>,
  );

  // La connexion temps réel n'est ouverte qu'une fois la session restaurée.
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
    getUserMediaMock.mockClear();
    window.localStorage.setItem('i-keketa.session.token', 'jeton-de-test');

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  });

  it('propose de trouver un inconnu au démarrage', async () => {
    await renderChatPage();

    expect(await screen.findByRole('button', { name: 'Trouver un inconnu' })).toBeInTheDocument();
  });

  it('rejoint la file d’attente et affiche l’état d’attente', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'queue:join')).toBe(true);
    });

    await emit('queue:status', { status: 'waiting', position: 1 });

    expect(await screen.findByText('Recherche d’un inconnu…')).toBeInTheDocument();
  });

  it('affiche le partenaire et permet d’envoyer un message', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));

    await emit('match:found', { matchId: 'match-1', partner: { displayName: 'Miora' } });

    expect(await screen.findByText('Miora')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Votre message'), 'Salut !');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      const sent = fakeSocket.emitted.find((entry) => entry.event === 'chat:message');
      expect(sent?.payload).toEqual({ matchId: 'match-1', content: 'Salut !' });
    });
  });

  it('lance automatiquement l’appel vidéo après la mise en relation', async () => {
    await renderChatPage();

    await emit('match:found', { matchId: 'match-1', partner: { displayName: 'Miora' } });

    await waitFor(() => {
      const request = fakeSocket.emitted.find((entry) => entry.event === 'media:request');
      expect(request?.payload).toEqual({ matchId: 'match-1', audio: true, video: true });
    });

    expect(await screen.findByText('Appel en cours…')).toBeInTheDocument();
  });

  it('affiche les messages reçus en temps réel', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));
    await emit('match:found', { matchId: 'match-1', partner: { displayName: 'Miora' } });

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

    await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));

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

    await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));
    await emit('match:found', { matchId: 'match-1', partner: { displayName: 'Miora' } });

    await user.click(screen.getByRole('button', { name: 'Passer à quelqu’un d’autre' }));

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'chat:skip')).toBe(true);
    });
  });

  it('affiche le nom affiché du partenaire quand il est renseigné', async () => {
    const user = userEvent.setup();
    await renderChatPage();

    await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));
    await emit('match:found', { matchId: 'match-1', partner: { displayName: 'Miora' } });

    expect(await screen.findByText('Miora')).toBeInTheDocument();
  });
});
