import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../utils/jwt';
import { findUserById } from '../modules/auth/auth.service';
import { messageContentSchema } from '../schemas/auth.schema';
import {
  mediaAcceptSchema,
  mediaAnswerSchema,
  mediaCandidateSchema,
  mediaEndSchema,
  mediaOfferSchema,
  mediaRequestSchema,
  mediaStateSchema,
} from '../schemas/media.schema';
import { MediaSignalingService } from '../modules/media/media-signaling.service';
import { MatchmakingService, matchRoom } from '../modules/chat/matchmaking.service';
import { saveMessage } from '../modules/chat/chat.service';
import { sanitizeText } from '../utils/text';

export interface SocketUser {
  id: string;
  displayName: string;
}

/**
 * Limite de débit par client pour l'envoi de messages (fenêtre glissante).
 */
class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);

    if (timestamps.length >= this.maxHits) {
      this.hits.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }

  reset(): void {
    this.hits.clear();
  }
}

const extractHandshakeToken = (socket: Socket): string | null => {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  return null;
};

export interface RealtimeServer {
  io: Server;
  matchmaking: MatchmakingService;
  media: MediaSignalingService;
  close: () => Promise<void>;
}

/**
 * Initialise le serveur temps réel (Socket.IO) sur le serveur HTTP existant.
 */
export const createRealtimeServer = (httpServer: HttpServer): RealtimeServer => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: false,
    },
    maxHttpBufferSize: 1e5,
  });

  const matchmaking = new MatchmakingService(io);
  const mediaSignaling = new MediaSignalingService(io, matchmaking);

  /** Nettoyages différés lors d'une déconnexion (tolérance aux coupures passagères). */
  const pendingDisconnects = new Map<string, NodeJS.Timeout>();
  const DISCONNECT_GRACE_MS = 8_000;

  matchmaking.setOnMatchEnded((matchId) => {
    void mediaSignaling.endCallForMatch(matchId, 'hangup');
  });

  const messageRateLimiter = new SlidingWindowRateLimiter(
    env.WS_MESSAGE_RATE_MAX,
    env.WS_MESSAGE_RATE_WINDOW_MS,
  );

  // Authentification de la connexion WebSocket.
  io.use(async (socket, next) => {
    try {
      const token = extractHandshakeToken(socket);

      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }

      const payload = verifyAccessToken(token);
      const user = await findUserById(payload.sub);

      if (!user) {
        return next(new Error('UNAUTHORIZED'));
      }

      socket.data.user = {
        id: String(user._id),
        displayName: payload.displayName,
      } satisfies SocketUser;

      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;

    logger.info('Client temps réel connecté.', { userId: user.id });

    // Reconnexion : annule un nettoyage en attente pour cet utilisateur.
    const pending = pendingDisconnects.get(user.id);

    if (pending) {
      clearTimeout(pending);
      pendingDisconnects.delete(user.id);
    }

    matchmaking.registerSocket(socket);

    socket.emit('queue:status', { status: 'idle' });

    /**
     * Exécute un gestionnaire asynchrone en capturant les erreurs pour éviter
     * tout rejet de promesse non traité.
     */
    const runSafely = (handler: () => Promise<void>): void => {
      handler().catch((error: unknown) => {
        logger.error('Erreur lors du traitement d’un événement temps réel.', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });

        socket.emit('chat:error', {
          code: 'INTERNAL_ERROR',
          message: 'Une erreur est survenue, veuillez réessayer.',
        });
      });
    };

    socket.on('queue:join', () => {
      runSafely(() => matchmaking.joinQueue(socket));
    });

    socket.on('queue:leave', () => {
      matchmaking.leaveQueue(user.id);
      socket.emit('queue:status', { status: 'idle' });
    });

    socket.on('chat:skip', () => {
      runSafely(async () => {
        const active = matchmaking.getActiveMatch(user.id);

        if (active) {
          await mediaSignaling.endCallForMatch(active.matchId, 'hangup');
        }

        await matchmaking.endMatch(user.id, 'user_skipped');
        await matchmaking.joinQueue(socket);
      });
    });

    /* ---------- Signalisation des appels audiovisuels (WebRTC) ---------- */

    socket.on('media:request', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaRequestSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_PAYLOAD',
            message: 'Demande d’appel invalide.',
          });
          return;
        }

        await mediaSignaling.handleRequest(
          socket,
          parsed.data.matchId,
          parsed.data.audio,
          parsed.data.video,
        );
      });
    });

    socket.on('media:accept', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaAcceptSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_PAYLOAD',
            message: 'Acceptation d’appel invalide.',
          });
          return;
        }

        await mediaSignaling.handleAccept(socket, parsed.data.matchId);
      });
    });

    socket.on('media:offer', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaOfferSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_PAYLOAD',
            message: 'Offre d’appel invalide.',
          });
          return;
        }

        mediaSignaling.relayDescription(
          socket,
          parsed.data.matchId,
          parsed.data.description,
          'media:offer',
        );
      });
    });

    socket.on('media:answer', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaAnswerSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_PAYLOAD',
            message: 'Réponse d’appel invalide.',
          });
          return;
        }

        mediaSignaling.relayDescription(
          socket,
          parsed.data.matchId,
          parsed.data.description,
          'media:answer',
        );
      });
    });

    socket.on('media:candidate', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaCandidateSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_PAYLOAD',
            message: 'Candidat ICE invalide.',
          });
          return;
        }

        mediaSignaling.relayCandidate(socket, parsed.data.matchId, parsed.data.candidate);
      });
    });

    socket.on('media:state', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaStateSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_PAYLOAD',
            message: 'État des médias invalide.',
          });
          return;
        }

        mediaSignaling.relayState(socket, {
          matchId: parsed.data.matchId,
          audio: parsed.data.audio,
          video: parsed.data.video,
        });
      });
    });

    socket.on('media:end', (payload: unknown) => {
      runSafely(async () => {
        const parsed = mediaEndSchema.safeParse(payload);

        if (!parsed.success) {
          return;
        }

        await mediaSignaling.handleEnd(socket, parsed.data.matchId, 'hangup');
      });
    });

    socket.on('chat:message', (payload: unknown) => {
      runSafely(async () => {
        const parsed = messageContentSchema.safeParse(payload);

        if (!parsed.success) {
          socket.emit('chat:error', {
            code: 'INVALID_MESSAGE',
            message: 'Message invalide.',
          });
          return;
        }

        if (!messageRateLimiter.isAllowed(user.id)) {
          socket.emit('chat:error', {
            code: 'RATE_LIMITED',
            message: 'Vous envoyez des messages trop rapidement.',
          });
          return;
        }

        const activeMatch = matchmaking.getActiveMatch(user.id);

        if (!activeMatch || activeMatch.matchId !== parsed.data.matchId) {
          socket.emit('chat:error', {
            code: 'NO_ACTIVE_MATCH',
            message: 'Aucune discussion en cours.',
          });
          return;
        }

        const content = sanitizeText(parsed.data.content);

        if (content.length === 0) {
          socket.emit('chat:error', {
            code: 'INVALID_MESSAGE',
            message: 'Le message ne peut pas être vide.',
          });
          return;
        }

        try {
          const message = await saveMessage({
            matchId: activeMatch.matchId,
            senderId: user.id,
            recipientId: activeMatch.partnerId,
            content,
          });

          io.to(matchRoom(activeMatch.matchId)).emit('chat:message', { message });
        } catch (error) {
          logger.error('Impossible d’enregistrer le message.', {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });

          socket.emit('chat:error', {
            code: 'MESSAGE_FAILED',
            message: 'Le message n’a pas pu être envoyé.',
          });
        }
      });
    });

    socket.on('disconnect', () => {
      logger.info('Client temps réel déconnecté.', { userId: user.id });

      // Tolérance aux coupures passagères : le nettoyage n'est effectué qu'après
      // un délai, annulé si l'utilisateur se reconnecte entre-temps.
      const existing = pendingDisconnects.get(user.id);

      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        pendingDisconnects.delete(user.id);

        runSafely(async () => {
          // L'utilisateur s'est reconnecté entre-temps : on annule le nettoyage.
          const currentSocket = matchmaking.getConnectedSocket(user.id);

          if (currentSocket && currentSocket.id !== socket.id) {
            logger.info('Reconnexion détectée, nettoyage annulé.', { userId: user.id });
            return;
          }

          const active = matchmaking.getActiveMatch(user.id);

          if (active) {
            await mediaSignaling.endCallForMatch(active.matchId, 'partner_disconnected');
          }

          await matchmaking.handleDisconnect(socket);
        });
      }, DISCONNECT_GRACE_MS);

      timer.unref();
      pendingDisconnects.set(user.id, timer);
    });
  });

  return {
    io,
    matchmaking,
    media: mediaSignaling,
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => resolve());
      }),
  };
};
