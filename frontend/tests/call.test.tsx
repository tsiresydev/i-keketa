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

/**
 * Le socket simule ici le client : une émission est seulement enregistrée.
 * Les messages du serveur sont simulés par `deliver`.
 */
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

    /** Émission du client : elle est seulement enregistrée. */
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
const deliver = async (event: string, payload?: unknown): Promise<void> => {
  await act(async () => {
    fakeSocket.deliver(event, payload);
  });
};

/**
 * Laisse les promesses en attente et les rendus React se terminer.
 */
const flushPendingTasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const renderChatPage = async () => {
  const view = render(
    <MemoryRouter initialEntries={['/chat']}>
      <SessionProvider>
        <ChatPage />
      </SessionProvider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(fakeSocket.listenerCount('connect')).toBeGreaterThan(0);
  });

  await act(async () => {
    fakeSocket.deliver('connect');
  });

  return view;
};

/**
 * Amène la page de chat en session avec un partenaire.
 */
const enterSession = async (): Promise<void> => {
  const user = userEvent.setup();
  await renderChatPage();

  await user.click(await screen.findByRole('button', { name: 'Trouver un inconnu' }));
  await deliver('match:found', { matchId: 'match-1', partner: { displayName: 'Miora' } });
};

/**
 * Fausse implémentation de `RTCPeerConnection` : jsdom ne fournit pas
 * l'API WebRTC.
 */
class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  /**
   * Simule le navigateur qui distribue l'événement `track` pendant
   * l'application de la description distante.
   */
  static autoTrackOnRemoteDescription = false;

  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = 'new';
  localDescription: unknown = null;
  remoteDescription: unknown = null;

  constructor(readonly configuration: { iceServers: unknown[] }) {
    FakePeerConnection.instances.push(this);
  }

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

    if (FakePeerConnection.autoTrackOnRemoteDescription) {
      this.emitRemoteTrack();
    }

    return Promise.resolve();
  }

  addIceCandidate(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {}

  /** Simule l'arrivée du flux distant (événement `track`). */
  emitRemoteTrack(): void {
    this.ontrack?.({
      streams: [{ id: 'flux-distant' }],
      track: { id: 'piste-distante' },
    });
  }

  /** Simule l'établissement de la connexion pair-à-pair. */
  emitConnected(): void {
    this.connectionState = 'connected';
    this.onconnectionstatechange?.();
  }
}

describe('Appel audiovisuel', () => {
  beforeEach(() => {
    fakeSocket.removeAllListeners();
    fakeSocket.emitted.length = 0;
    fakeSocket.connected = true;
    getUserMediaMock.mockClear();
    FakePeerConnection.instances.length = 0;
    FakePeerConnection.autoTrackOnRemoteDescription = false;
    window.localStorage.setItem('i-keketa.session.token', 'jeton-de-test');

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  });

  it('propose de lancer un appel vidéo une fois la session établie', async () => {
    await enterSession();

    expect(
      await screen.findByRole('button', { name: '📹 Lancer l’appel vidéo' }),
    ).toBeInTheDocument();
  });

  it('lance automatiquement l’appel vidéo dès qu’un partenaire est trouvé', async () => {
    await enterSession();

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const request = fakeSocket.emitted.find((entry) => entry.event === 'media:request');
      expect(request?.payload).toEqual({ matchId: 'match-1', audio: true, video: true });
    });

    expect(await screen.findByText('Appel en cours…')).toBeInTheDocument();
    expect(
      await screen.findByText(/Appel vidéo automatique : autorisez l’accès à la caméra/),
    ).toBeInTheDocument();
  });

  it('accepte automatiquement l’appel entrant', async () => {
    await enterSession();

    await deliver('media:request', { matchId: 'match-1', audio: true, video: true });

    await waitFor(() => {
      const accept = fakeSocket.emitted.find((entry) => entry.event === 'media:accept');
      expect(accept?.payload).toEqual({ matchId: 'match-1' });
    });

    expect(await screen.findByText('Connexion à l’appel…')).toBeInTheDocument();
  });

  it('permet de relancer l’appel vidéo manuellement après un raccrochage', async () => {
    const user = userEvent.setup();
    await enterSession();

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:request')).toBe(true);
    });

    await deliver('media:ended', { matchId: 'match-1', reason: 'hangup' });

    fakeSocket.emitted.length = 0;

    await user.click(await screen.findByRole('button', { name: '📹 Lancer l’appel vidéo' }));

    await waitFor(() => {
      const request = fakeSocket.emitted.find((entry) => entry.event === 'media:request');
      expect(request?.payload).toEqual({ matchId: 'match-1', audio: true, video: true });
    });
  });

  it('n’émet qu’une seule demande quand un appel entrant arrive', async () => {
    await enterSession();

    await deliver('media:request', { matchId: 'match-1', audio: true, video: true });

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:accept')).toBe(true);
    });

    // La demande automatique a pu partir avant l'appel entrant : aucune
    // seconde demande concurrente ne doit être émise.
    const requests = fakeSocket.emitted.filter((entry) => entry.event === 'media:request');

    expect(requests.length).toBeLessThanOrEqual(1);
  });

  it('n’émet une offre que depuis l’appelant', async () => {
    await enterSession();

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:request')).toBe(true);
    });

    await deliver('media:accepted', { matchId: 'match-1' });

    await waitFor(() => {
      const offer = fakeSocket.emitted.find((entry) => entry.event === 'media:offer');
      expect(offer).toBeDefined();
    });
  });

  it('affiche un message lorsque l’accès aux médias est refusé', async () => {
    getUserMediaMock.mockRejectedValueOnce(
      new DOMException('Permission refusée', 'NotAllowedError'),
    );

    await enterSession();

    expect(
      await screen.findByText('L’accès à la caméra ou au micro a été refusé.'),
    ).toBeInTheDocument();
  });

  it('ignore un appel concernant une autre session', async () => {
    await enterSession();

    await deliver('media:request', { matchId: 'autre-session', audio: true, video: true });

    expect(screen.queryByText(/Appel entrant/)).not.toBeInTheDocument();
    expect(fakeSocket.emitted.some((entry) => entry.event === 'media:accept')).toBe(false);
  });

  it('ignore la demande concurrente rejetée par le serveur', async () => {
    await enterSession();

    await deliver('chat:error', {
      code: 'CALL_ALREADY_ACTIVE',
      message: 'Un appel est déjà en cours.',
    });

    expect(screen.queryByText('Un appel est déjà en cours.')).not.toBeInTheDocument();
  });

  it('signale la fin de l’appel lorsque le partenaire raccroche', async () => {
    await enterSession();

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:request')).toBe(true);
    });

    await deliver('media:ended', { matchId: 'match-1', reason: 'hangup' });

    expect(await screen.findByText('Votre partenaire a raccroché.')).toBeInTheDocument();
  });

  it('bascule en « en cours » quand la connexion pair-à-pair s’établit', async () => {
    await enterSession();

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:request')).toBe(true);
    });

    await deliver('media:accepted', { matchId: 'match-1' });

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:offer')).toBe(true);
    });

    expect(await screen.findByText('Connexion à l’appel…')).toBeInTheDocument();

    const peer = FakePeerConnection.instances[0];

    expect(peer).toBeDefined();

    await act(async () => {
      peer?.emitConnected();
      await flushPendingTasks();
    });

    expect(screen.getByRole('region', { name: 'Appel en cours' })).toBeInTheDocument();
    expect(screen.queryByText('Connexion à l’appel…')).not.toBeInTheDocument();
  });

  it('ne rebascule pas en « connexion » après l’arrivée du flux distant', async () => {
    // Le navigateur distribue `track` pendant l'application de la description
    // distante : le statut « en cours » ne doit pas être écrasé ensuite.
    FakePeerConnection.autoTrackOnRemoteDescription = true;

    await enterSession();

    await deliver('media:request', { matchId: 'match-1', audio: true, video: true });

    await waitFor(() => {
      expect(fakeSocket.emitted.some((entry) => entry.event === 'media:accept')).toBe(true);
    });

    await deliver('media:offer', {
      matchId: 'match-1',
      description: JSON.stringify({ type: 'offer', sdp: 'v=0' }),
    });

    // Toute la négociation (réponse émise, rendus appliqués) doit être
    // terminée avant de contrôler l'état final affiché.
    await act(async () => {
      await flushPendingTasks();
    });

    expect(screen.getByRole('region', { name: 'Appel en cours' })).toBeInTheDocument();
    expect(screen.queryByText('Connexion à l’appel…')).not.toBeInTheDocument();
  });
});
