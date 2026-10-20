import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../utils/jwt';
import { findUserById } from '../modules/auth/auth.service';
import { messageContentSchema } from '../schemas/auth.schema';
import { MatchmakingService, matchRoom } from '../modules/chat/matchmaking.service';
import { saveMessage } from '../modules/chat/chat.service';
import { sanitizeText } from '../utils/text';

export interface SocketUser {
  id: string;
  email: string;
  pseudonym: string;
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
        email: user.email,
        pseudonym: user.pseudonym,
      } satisfies SocketUser;

      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;

    logger.info('Client temps réel connecté.', { userId: user.id });

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
        await matchmaking.endMatch(user.id, 'user_skipped');
        await matchmaking.joinQueue(socket);
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
      runSafely(() => matchmaking.handleDisconnect(socket));
    });
  });

  return {
    io,
    matchmaking,
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => resolve());
      }),
  };
};
