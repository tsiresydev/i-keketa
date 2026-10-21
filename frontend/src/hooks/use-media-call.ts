import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { MediaCallStatus, MediaCallStatePayload } from '../types';

/**
 * Serveurs STUN utilisés pour la négociation ICE.
 * Configurables via `VITE_STUN_URLS` (séparés par des virgules).
 */
const DEFAULT_STUN_URL = 'stun:stun.l.google.com:19302';

const stunServers = (): RTCIceServer[] => {
  const configured = (import.meta.env.VITE_STUN_URLS as string | undefined) ?? DEFAULT_STUN_URL;

  return configured
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));
};

export interface MediaCallState {
  status: MediaCallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  /** Micro et caméra du partenaire (tels qu'il les déclare). */
  partnerMedia: { audio: boolean; video: boolean };
  error: string | null;
  notice: string | null;
}

export interface MediaCallActions {
  startCall: () => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  clearError: () => void;
  clearNotice: () => void;
}

const initialState: MediaCallState = {
  status: 'idle',
  localStream: null,
  remoteStream: null,
  isMicrophoneEnabled: true,
  isCameraEnabled: true,
  partnerMedia: { audio: true, video: true },
  error: null,
  notice: null,
};

const MEDIA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'L’accès à la caméra ou au micro a été refusé.',
  NotFoundError: 'Aucune caméra ou micro n’a été détecté.',
  NotReadableError: 'La caméra ou le micro est déjà utilisé par une autre application.',
  OverconstrainedError: 'Aucun flux vidéo ou audio disponible ne correspond aux contraintes.',
  SecurityError: 'L’accès à la caméra ou au micro est bloqué par le navigateur.',
};

const describeMediaError = (error: unknown): string => {
  if (error instanceof DOMException) {
    const message = MEDIA_ERROR_MESSAGES[error.name];

    if (message) {
      return message;
    }
  }

  if (error instanceof Error) {
    const message = MEDIA_ERROR_MESSAGES[error.name];

    if (message) {
      return message;
    }
  }

  return 'Impossible d’accéder à la caméra ou au micro.';
};

/**
 * Pilote un appel audiovisuel WebRTC à deux participants au sein d'une
 * session de chat.
 *
 * Le socket est partagé avec le chat : la signalisation (requête, acceptation,
 * description SDP, candidats ICE, état micro/caméra) passe par les événements
 * `media:*`, relayés par le serveur vers le partenaire.
 */
export const useMediaCall = (
  socket: Socket | null,
  matchId: string | null,
): MediaCallState & MediaCallActions => {
  const [state, setState] = useState<MediaCallState>(initialState);

  const socketRef = useRef<Socket | null>(socket);
  const matchIdRef = useRef<string | null>(matchId);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  /** Vrai si l'utilisateur est à l'origine de l'appel en cours (émetteur de l'offre). */
  const isCallerRef = useRef(false);
  /** Candidats ICE reçus avant la description distante (mise en ordre). */
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  /**
   * Ferme la connexion pair-à-pair et arrête les pistes locales.
   */
  const closePeer = useCallback(() => {
    const peer = peerRef.current;
    peerRef.current = null;

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }

    const localStream = localStreamRef.current;
    localStreamRef.current = null;

    localStream?.getTracks().forEach((track) => track.stop());
  }, []);

  const resetCall = useCallback(
    (nextState: Partial<MediaCallState> = {}) => {
      closePeer();
      pendingCandidatesRef.current = [];
      remoteDescriptionSetRef.current = false;
      isCallerRef.current = false;

      setState({
        ...initialState,
        ...nextState,
      });
    },
    [closePeer],
  );

  /**
   * Acquiert les médias locaux (micro et caméra).
   */
  const acquireLocalMedia = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('MEDIA_UNSUPPORTED');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
    });
  }, []);

  /**
   * Crée la connexion pair-à-pair et y ajoute les pistes locales.
   */
  const createPeer = useCallback(
    (localStream: MediaStream): RTCPeerConnection => {
      const peer = new RTCPeerConnection({ iceServers: stunServers() });

      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });

      peer.onicecandidate = (event) => {
        const currentMatchId = matchIdRef.current;

        if (!event.candidate || !currentMatchId) {
          return;
        }

        socketRef.current?.emit('media:candidate', {
          matchId: currentMatchId,
          candidate: JSON.stringify(event.candidate.toJSON()),
        });
      };

      peer.ontrack = (event) => {
        const [stream] = event.streams;

        setState((previous) => ({
          ...previous,
          remoteStream: stream ?? new MediaStream([event.track]),
          status: 'in-call',
        }));
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed') {
          setState((previous) => ({
            ...previous,
            error: 'La connexion à l’appel a échoué.',
          }));
          resetCall();
        }
      };

      peerRef.current = peer;
      return peer;
    },
    [resetCall],
  );

  /**
   * Ajoute un candidat ICE, en attendant la description distante si besoin.
   */
  const addCandidate = useCallback(async (candidate: RTCIceCandidateInit): Promise<void> => {
    const peer = peerRef.current;

    if (!peer) {
      return;
    }

    if (!remoteDescriptionSetRef.current) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }

    try {
      await peer.addIceCandidate(candidate);
    } catch {
      // Un candidat obsolète ne doit pas interrompre l'appel.
    }
  }, []);

  const flushCandidates = useCallback(async (): Promise<void> => {
    const peer = peerRef.current;

    if (!peer) {
      return;
    }

    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];

    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Candidat ignoré.
      }
    }
  }, []);

  /* ---------- Gestion des événements du partenaire ---------- */

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRequest = (payload: { matchId: string; audio: boolean; video: boolean }): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      setState((previous) => ({
        ...previous,
        status: 'ringing',
        partnerMedia: { audio: payload.audio, video: payload.video },
        error: null,
      }));
    };

    const handleAccepted = (payload: { matchId: string }): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      // Seul l'appelant émet l'offre : le serveur notifie aussi l'appelé,
      // qui ne doit pas produire une seconde offre (conflit de glare).
      if (!isCallerRef.current) {
        return;
      }
      // Le demandeur devient l'émetteur de l'offre WebRTC.
      void (async () => {
        try {
          const localStream = localStreamRef.current;

          if (!localStream) {
            return;
          }

          const peer = peerRef.current ?? createPeer(localStream);

          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          socket.emit('media:offer', {
            matchId: payload.matchId,
            description: JSON.stringify(peer.localDescription),
          });

          setState((previous) => ({ ...previous, status: 'connecting', error: null }));
          isCallerRef.current = false;
        } catch {
          setState((previous) => ({
            ...previous,
            error: 'La négociation de l’appel a échoué.',
          }));
        }
      })();
    };

    const handleOffer = (payload: { matchId: string; description: string }): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      void (async () => {
        try {
          const localStream = localStreamRef.current;

          if (!localStream) {
            return;
          }

          const peer = peerRef.current ?? createPeer(localStream);

          await peer.setRemoteDescription(
            JSON.parse(payload.description) as RTCSessionDescriptionInit,
          );
          remoteDescriptionSetRef.current = true;
          await flushCandidates();

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          socket.emit('media:answer', {
            matchId: payload.matchId,
            description: JSON.stringify(peer.localDescription),
          });

          setState((previous) => ({ ...previous, status: 'connecting' }));
        } catch {
          setState((previous) => ({
            ...previous,
            error: 'La négociation de l’appel a échoué.',
          }));
        }
      })();
    };

    const handleAnswer = (payload: { matchId: string; description: string }): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      void (async () => {
        try {
          const peer = peerRef.current;

          if (!peer) {
            return;
          }

          await peer.setRemoteDescription(
            JSON.parse(payload.description) as RTCSessionDescriptionInit,
          );
          remoteDescriptionSetRef.current = true;
          await flushCandidates();

          setState((previous) => ({ ...previous, status: 'connecting' }));
        } catch {
          setState((previous) => ({
            ...previous,
            error: 'La négociation de l’appel a échoué.',
          }));
        }
      })();
    };

    const handleCandidate = (payload: { matchId: string; candidate: string }): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      try {
        void addCandidate(JSON.parse(payload.candidate) as RTCIceCandidateInit);
      } catch {
        // Candidat illisible : ignoré.
      }
    };

    const handleState = (payload: MediaCallStatePayload): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      setState((previous) => ({
        ...previous,
        partnerMedia: { audio: payload.audio, video: payload.video },
      }));
    };

    const handleEnded = (payload: { matchId: string; reason?: string }): void => {
      if (payload.matchId !== matchIdRef.current) {
        return;
      }

      resetCall({
        notice:
          payload.reason === 'hangup' ? 'Votre partenaire a raccroché.' : 'L’appel est terminé.',
      });
    };

    socket.on('media:request', handleRequest);
    socket.on('media:accepted', handleAccepted);
    socket.on('media:offer', handleOffer);
    socket.on('media:answer', handleAnswer);
    socket.on('media:candidate', handleCandidate);
    socket.on('media:state', handleState);
    socket.on('media:ended', handleEnded);

    return () => {
      socket.off('media:request', handleRequest);
      socket.off('media:accepted', handleAccepted);
      socket.off('media:offer', handleOffer);
      socket.off('media:answer', handleAnswer);
      socket.off('media:candidate', handleCandidate);
      socket.off('media:state', handleState);
      socket.off('media:ended', handleEnded);
    };
  }, [socket, addCandidate, createPeer, flushCandidates, resetCall]);

  /* ---------- Changement de session : l'appel estclos ---------- */

  const sessionInitialisedRef = useRef(false);

  useEffect(() => {
    if (!sessionInitialisedRef.current) {
      sessionInitialisedRef.current = true;
      return;
    }

    // Nouvelle session (ou fin de session) : l'appel en cours est abandonné.
    resetCall();
  }, [matchId, resetCall]);

  useEffect(() => {
    return () => {
      closePeer();
    };
  }, [closePeer]);

  /* ---------- Actions utilisateur ---------- */

  const startCall = useCallback(async (): Promise<void> => {
    const currentMatchId = matchIdRef.current;

    if (!currentMatchId || !socketRef.current) {
      return;
    }

    setState((previous) => ({ ...previous, status: 'requesting', error: null, notice: null }));
    isCallerRef.current = true;

    try {
      const localStream = await acquireLocalMedia();
      localStreamRef.current = localStream;

      setState((previous) => ({
        ...previous,
        localStream,
        isMicrophoneEnabled: true,
        isCameraEnabled: true,
      }));

      socketRef.current.emit('media:request', {
        matchId: currentMatchId,
        audio: true,
        video: true,
      });
    } catch (error) {
      resetCall({
        error:
          error instanceof Error && error.message === 'MEDIA_UNSUPPORTED'
            ? 'Votre navigateur ne permet pas d’accéder à la caméra ou au micro.'
            : describeMediaError(error),
      });
    }
  }, [acquireLocalMedia, resetCall]);

  const acceptCall = useCallback(async (): Promise<void> => {
    const currentMatchId = matchIdRef.current;

    if (!currentMatchId || !socketRef.current) {
      return;
    }

    setState((previous) => ({ ...previous, status: 'connecting', error: null }));

    try {
      const localStream = await acquireLocalMedia();
      localStreamRef.current = localStream;

      createPeer(localStream);

      setState((previous) => ({
        ...previous,
        localStream,
        isMicrophoneEnabled: true,
        isCameraEnabled: true,
      }));

      socketRef.current.emit('media:accept', { matchId: currentMatchId });
    } catch (error) {
      resetCall({
        error:
          error instanceof Error && error.message === 'MEDIA_UNSUPPORTED'
            ? 'Votre navigateur ne permet pas d’accéder à la caméra ou au micro.'
            : describeMediaError(error),
      });
    }
  }, [acquireLocalMedia, createPeer, resetCall]);

  const declineCall = useCallback((): void => {
    const currentMatchId = matchIdRef.current;

    if (currentMatchId) {
      socketRef.current?.emit('media:end', { matchId: currentMatchId });
    }

    resetCall({ notice: 'Appel refusé.' });
  }, [resetCall]);

  const endCall = useCallback((): void => {
    const currentMatchId = matchIdRef.current;

    if (currentMatchId) {
      socketRef.current?.emit('media:end', { matchId: currentMatchId });
    }

    resetCall();
  }, [resetCall]);

  const toggleMicrophone = useCallback((): void => {
    const localStream = localStreamRef.current;
    const currentMatchId = matchIdRef.current;

    if (!localStream || !currentMatchId) {
      return;
    }

    const nextEnabled = !localStream.getAudioTracks().some((track) => track.enabled);

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });

    setState((previous) => ({ ...previous, isMicrophoneEnabled: nextEnabled }));

    socketRef.current?.emit('media:state', {
      matchId: currentMatchId,
      audio: nextEnabled,
      video: localStream.getVideoTracks().some((track) => track.enabled),
    });
  }, []);

  const toggleCamera = useCallback((): void => {
    const localStream = localStreamRef.current;
    const currentMatchId = matchIdRef.current;

    if (!localStream || !currentMatchId) {
      return;
    }

    const nextEnabled = !localStream.getVideoTracks().some((track) => track.enabled);

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });

    setState((previous) => ({ ...previous, isCameraEnabled: nextEnabled }));

    socketRef.current?.emit('media:state', {
      matchId: currentMatchId,
      audio: localStream.getAudioTracks().some((track) => track.enabled),
      video: nextEnabled,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((previous) => ({ ...previous, error: null }));
  }, []);

  const clearNotice = useCallback(() => {
    setState((previous) => ({ ...previous, notice: null }));
  }, []);

  return {
    ...state,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    clearError,
    clearNotice,
  };
};
