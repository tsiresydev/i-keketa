import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createChatSocket } from '../lib/socket-client';
import { validateMessage } from '../lib/validation';
import type {
  ChatErrorPayload,
  ChatMessage,
  ChatStatus,
  ConnectionStatus,
  MatchEndedPayload,
  MatchFoundPayload,
  QueueStatusPayload,
} from '../types';

export interface ChatSocketState {
  connectionStatus: ConnectionStatus;
  chatStatus: ChatStatus;
  matchId: string | null;
  partnerPseudonym: string | null;
  partnerDisplayName: string | null;
  partnerPhotoUrl: string | null;
  messages: ChatMessage[];
  error: string | null;
  notice: string | null;
  /** Socket temps réel partagé (utilisé par la signalisation audiovisuelle). */
  socket: Socket | null;
}

export interface ChatSocketActions {
  joinQueue: () => void;
  leaveQueue: () => void;
  skipPartner: () => void;
  startDirectChat: (userId: string) => boolean;
  sendMessage: (content: string) => boolean;
  clearError: () => void;
  clearNotice: () => void;
}

const END_REASON_MESSAGES: Record<MatchEndedPayload['reason'], string> = {
  user_skipped: 'Vous avez quitté la discussion.',
  partner_disconnected: 'Votre partenaire s’est déconnecté.',
  user_disconnected: 'La discussion est terminée.',
};

/**
 * Erreurs ignorées.
 *
 * L'appel vidéo est proposé automatiquement par les deux participants : la
 * demande concurrente rejetée par le serveur est donc normale et ne doit pas
 * être signalée à l'utilisateur.
 */
const IGNORED_CHAT_ERROR_CODES = new Set(['CALL_ALREADY_ACTIVE']);

const initialState: ChatSocketState = {
  connectionStatus: 'connecting',
  chatStatus: 'idle',
  matchId: null,
  partnerPseudonym: null,
  partnerDisplayName: null,
  partnerPhotoUrl: null,
  messages: [],
  error: null,
  notice: null,
  socket: null,
};

export const useChatSocket = (token: string | null): ChatSocketState & ChatSocketActions => {
  const [state, setState] = useState<ChatSocketState>(initialState);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      setState(initialState);
      return;
    }

    const socket = createChatSocket(token);
    socketRef.current = socket;

    setState((previous) => ({ ...previous, socket }));

    socket.on('connect', () => {
      setState((previous) => ({ ...previous, connectionStatus: 'connected', error: null }));
    });

    socket.on('disconnect', () => {
      setState((previous) => ({
        ...previous,
        connectionStatus: 'disconnected',
        chatStatus: 'idle',
        matchId: null,
        partnerPseudonym: null,
        partnerDisplayName: null,
        partnerPhotoUrl: null,
      }));
    });

    socket.on('connect_error', () => {
      setState((previous) => ({
        ...previous,
        connectionStatus: 'disconnected',
        error: 'Connexion à la plateforme impossible. Réessayez dans un instant.',
      }));
    });

    socket.on('queue:status', (payload: QueueStatusPayload) => {
      setState((previous) => ({
        ...previous,
        chatStatus: payload.status === 'waiting' ? 'waiting' : 'idle',
        error: null,
      }));
    });

    socket.on('match:found', (payload: MatchFoundPayload) => {
      setState((previous) => ({
        ...previous,
        chatStatus: 'matched',
        matchId: payload.matchId,
        partnerPseudonym: payload.partner.pseudonym,
        partnerDisplayName: payload.partner.displayName ?? null,
        partnerPhotoUrl: payload.partner.photoUrl ?? null,
        messages: [],
        notice: null,
        error: null,
      }));
    });

    socket.on('chat:history', (payload: { matchId: string; messages: ChatMessage[] }) => {
      setState((previous) =>
        previous.matchId === payload.matchId
          ? { ...previous, messages: payload.messages }
          : previous,
      );
    });

    socket.on('chat:message', (payload: { message?: ChatMessage }) => {
      const message = payload?.message;

      if (!message) {
        return;
      }

      setState((previous) => {
        if (previous.matchId !== message.matchId) {
          return previous;
        }

        const alreadyPresent = previous.messages.some((item) => item.id === message.id);

        if (alreadyPresent) {
          return previous;
        }

        return { ...previous, messages: [...previous.messages, message] };
      });
    });

    socket.on('match:ended', (payload: MatchEndedPayload) => {
      setState((previous) => ({
        ...previous,
        chatStatus: 'idle',
        matchId: null,
        partnerPseudonym: null,
        partnerDisplayName: null,
        partnerPhotoUrl: null,
        messages: [],
        notice: END_REASON_MESSAGES[payload.reason] ?? 'La discussion est terminée.',
      }));
    });

    socket.on('chat:error', (payload: ChatErrorPayload) => {
      if (IGNORED_CHAT_ERROR_CODES.has(payload.code)) {
        return;
      }

      setState((previous) => ({ ...previous, error: payload.message }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setState((previous) => ({ ...previous, socket: null }));
    };
  }, [token]);

  const joinQueue = useCallback(() => {
    socketRef.current?.emit('queue:join');
  }, []);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('queue:leave');
  }, []);

  const skipPartner = useCallback(() => {
    socketRef.current?.emit('chat:skip');
  }, []);

  /**
   * Demande une discussion directe avec l'utilisateur ciblé.
   * Le serveur répond par `match:found` ou par une erreur `USER_UNAVAILABLE`.
   */
  const startDirectChat = useCallback((userId: string): boolean => {
    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setState((previous) => ({
        ...previous,
        error: 'La connexion est perdue. Reconnectez-vous pour démarrer la discussion.',
      }));
      return false;
    }

    socket.emit('chat:start', { userId });
    return true;
  }, []);

  const sendMessage = useCallback(
    (content: string): boolean => {
      const validationError = validateMessage(content);

      if (validationError) {
        setState((previous) => ({ ...previous, error: validationError }));
        return false;
      }

      const socket = socketRef.current;

      if (!socket || !socket.connected) {
        setState((previous) => ({
          ...previous,
          error: 'La connexion est perdue. Reconnectez-vous pour continuer à discuter.',
        }));
        return false;
      }

      socket.emit('chat:message', { matchId: state.matchId, content: content.trim() });
      return true;
    },
    [state.matchId],
  );

  const clearError = useCallback(() => {
    setState((previous) => ({ ...previous, error: null }));
  }, []);

  const clearNotice = useCallback(() => {
    setState((previous) => ({ ...previous, notice: null }));
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    skipPartner,
    startDirectChat,
    sendMessage,
    clearError,
    clearNotice,
  };
};
