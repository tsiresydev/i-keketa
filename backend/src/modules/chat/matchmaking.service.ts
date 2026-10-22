import { Types } from 'mongoose';
import type { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import { MatchModel, type MatchEndReason } from '../../models/match.model';
import { MessageModel } from '../../models/message.model';

/**
 * Identité minimale d'un visiteur connecté, transmise via `socket.data.user`.
 */
export interface SocketIdentity {
  id: string;
  displayName: string;
}

/**
 * Identité du partenaire transmise au client lors d'une mise en relation.
 * Seul le nom affiché choisi par le visiteur est partagé.
 */
export interface PartnerProfile {
  displayName: string;
}

export const matchRoom = (matchId: string): string => `match:${matchId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

export interface MatchPartner extends PartnerProfile {
  userId: string;
}

export interface WaitingEntry extends MatchPartner {
  socketId: string;
}

export interface ActiveMatch {
  matchId: string;
  partnerId: string;
  partnerSocketId: string;
  partnerDisplayName: string;
}

export const MATCH_HISTORY_LIMIT = 100;

export const CHAT_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

/**
 * Service de mise en relation aléatoire.
 *
 * La file d'attente est maintenue en mémoire sur l'instance du serveur ;
 * les sessions (Match) et les messages sont persistés dans MongoDB.
 */
export class MatchmakingService {
  private readonly io: Server;
  private readonly waiting: WaitingEntry[] = [];
  private readonly activeMatches = new Map<string, ActiveMatch>();
  /** Dernier socket connu pour chaque utilisateur connecté. */
  private readonly socketsByUser = new Map<string, Socket>();
  /** Rappelé à chaque fin de session (utilisé pour clore les appels audiovisuels). */
  private onMatchEnded: ((matchId: string) => void) | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Enregistre le rappel invoqué à la fin d'une session de chat.
   */
  setOnMatchEnded(callback: (matchId: string) => void): void {
    this.onMatchEnded = callback;
  }

  /**
   * Enregistre le socket d'un utilisateur nouvellement connecté.
   */
  registerSocket(socket: Socket): void {
    const user = socket.data.user as SocketIdentity | undefined;

    if (!user) {
      return;
    }

    this.socketsByUser.set(user.id, socket);
    this.broadcastPresence();
  }

  /**
   * Oublie un socket déconnecté (un autre onglet peut rester connecté).
   */
  unregisterSocket(socket: Socket): void {
    const user = socket.data.user as SocketIdentity | undefined;

    if (!user) {
      return;
    }

    if (this.socketsByUser.get(user.id)?.id === socket.id) {
      this.socketsByUser.delete(user.id);
      this.broadcastPresence();
    }
  }

  /**
   * Socket actuellement associé à un utilisateur.
   */
  getConnectedSocket(userId: string): Socket | undefined {
    return this.socketsByUser.get(userId);
  }

  /**
   * Place l'utilisateur dans la file d'attente et tente de former un duo.
   * Le partenaire est choisi de manière aléatoire parmi les utilisateurs en attente.
   */
  async joinQueue(socket: Socket): Promise<void> {
    const user = socket.data.user as SocketIdentity | undefined;

    if (!user) {
      socket.emit('chat:error', {
        code: CHAT_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentification requise.',
      });
      return;
    }

    // Un utilisateur déjà en discussion quitte sa session avant de rejoindre la file.
    if (this.activeMatches.has(user.id)) {
      await this.endMatch(user.id, 'user_skipped');
    }

    this.leaveQueue(user.id);

    const partner = this.pickRandomPartner(user.id);

    if (!partner) {
      this.waiting.push({
        userId: user.id,
        socketId: socket.id,
        displayName: user.displayName,
      });
      socket.emit('queue:status', { status: 'waiting', position: this.waiting.length });
      logger.info('Utilisateur en attente de partenaire.', { userId: user.id });
      this.broadcastPresence();
      return;
    }

    await this.createMatch(socket, partner);
    this.broadcastPresence();
  }

  /**
   * Retire l'utilisateur de la file d'attente.
   */
  leaveQueue(userId: string): void {
    const index = this.waiting.findIndex((entry) => entry.userId === userId);

    if (index >= 0) {
      this.waiting.splice(index, 1);
      this.broadcastPresence();
    }
  }

  /**
   * Met fin à la session en cours de l'utilisateur et en informe le partenaire.
   */
  async endMatch(userId: string, reason: MatchEndReason): Promise<void> {
    const active = this.activeMatches.get(userId);

    if (!active) {
      return;
    }

    this.activeMatches.delete(userId);
    this.activeMatches.delete(active.partnerId);
    this.leaveQueue(userId);
    this.leaveQueue(active.partnerId);

    const matchId = active.matchId;

    try {
      await MatchModel.updateOne(
        { _id: matchId, status: 'active' },
        { status: 'ended', endedAt: new Date(), endedReason: reason },
      );
    } catch (error) {
      logger.error('Impossible de clôturer la session de chat.', {
        matchId: String(matchId),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.io.to(matchRoom(matchId)).emit('match:ended', { matchId, reason });

    this.broadcastPresence();

    this.onMatchEnded?.(matchId);
  }

  getActiveMatch(userId: string): ActiveMatch | undefined {
    return this.activeMatches.get(userId);
  }

  /**
   * Nettoyage lors de la déconnexion d'un client.
   */
  async handleDisconnect(socket: Socket): Promise<void> {
    const user = socket.data.user as { id: string } | undefined;

    if (!user) {
      return;
    }

    const wasWaiting = this.waiting.some((entry) => entry.socketId === socket.id);
    this.leaveQueue(user.id);
    this.unregisterSocket(socket);

    if (this.activeMatches.has(user.id)) {
      await this.endMatch(user.id, 'partner_disconnected');
    }

    if (wasWaiting) {
      logger.info('Utilisateur déconnecté de la file d’attente.', { userId: user.id });
    }

    this.broadcastPresence();
  }

  /**
   * Statistiques de la file d'attente (diagnostic).
   */
  getQueueSize(): number {
    return this.waiting.length;
  }

  /**
   * Nombre d'utilisateurs actuellement connectés (source de vérité).
   */
  getOnlineCount(): number {
    return this.socketsByUser.size;
  }

  /**
   * Nombre de partenaires disponibles pour un nouveau chat : utilisateurs
   * connectés qui ne sont pas déjà dans une conversation active.
   */
  getAvailableCount(): number {
    const busy = this.activeMatches.size * 2;

    return Math.max(0, this.socketsByUser.size - busy);
  }

  /**
   * Diffuse le nombre d'utilisateurs en ligne et de partenaires disponibles
   * à tous les clients connectés.
   */
  broadcastPresence(): void {
    const payload = {
      online: this.getOnlineCount(),
      available: this.getAvailableCount(),
    };

    this.io.emit('presence:update', payload);
  }

  /**
   * Sélectionne aléatoirement un partenaire parmi les utilisateurs en attente
   * et le retire immédiatement de la file (évite qu'il soit retenu par une
   * autre mise en relation concurrente).
   */
  private pickRandomPartner(currentUserId: string): WaitingEntry | null {
    const candidateIndexes = this.waiting
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.userId !== currentUserId);

    if (candidateIndexes.length === 0) {
      return null;
    }

    const chosen = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)];

    if (!chosen) {
      return null;
    }

    this.waiting.splice(chosen.index, 1);

    return chosen.entry;
  }

  /**
   * Quitte les anciennes rooms de session d'un socket.
   */
  private leavePreviousMatchRooms(socket: Socket): void {
    for (const room of socket.rooms) {
      if (room.startsWith('match:')) {
        socket.leave(room);
      }
    }
  }

  /**
   * Crée la session à partir de la file d'attente aléatoire.
   */
  private async createMatch(joiningSocket: Socket, partner: WaitingEntry): Promise<void> {
    const partnerSocket = this.io.sockets.sockets.get(partner.socketId);

    if (!partnerSocket) {
      // Le partenaire s'est déconnecté entre-temps : il est replacé dans la file.
      this.waiting.push(partner);
      return;
    }

    await this.establishMatch(joiningSocket, partnerSocket, partner);
  }

  /**
   * Établit la session entre deux sockets : persistance, rooms, événement
   * `match:found` et historique.
   *
   * Les profils sont relus en base au moment de la mise en relation : un nom
   * affiché ou une photo modifiés après la connexion du socket sont ainsi
   * reflétés dans le `match:found`.
   */
  private async establishMatch(
    joiningSocket: Socket,
    partnerSocket: Socket,
    partner: MatchPartner,
  ): Promise<void> {
    const joiningUser = joiningSocket.data.user as SocketIdentity;

    const joiningProfile: PartnerProfile = { displayName: joiningUser.displayName };
    const partnerProfile: PartnerProfile = { displayName: partner.displayName };

    let match;

    try {
      match = await MatchModel.create({
        participants: [new Types.ObjectId(joiningUser.id), new Types.ObjectId(partner.userId)],
        participantDisplayNames: [joiningUser.displayName, partner.displayName],
        status: 'active',
      });
    } catch (error) {
      // La session n'a pas pu être créée : le partenaire est replacé dans la file d'attente.
      this.waiting.push({ ...partner, socketId: partnerSocket.id });
      logger.error('Impossible de créer la session de chat.', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const matchId = String(match._id);

    this.activeMatches.set(joiningUser.id, {
      matchId,
      partnerId: partner.userId,
      partnerSocketId: partnerSocket.id,
      partnerDisplayName: partnerProfile.displayName,
    });
    this.activeMatches.set(partner.userId, {
      matchId,
      partnerId: joiningUser.id,
      partnerSocketId: joiningSocket.id,
      partnerDisplayName: joiningProfile.displayName,
    });

    this.leavePreviousMatchRooms(joiningSocket);
    joiningSocket.join(matchRoom(matchId));
    joiningSocket.join(userRoom(joiningUser.id));

    this.leavePreviousMatchRooms(partnerSocket);
    partnerSocket.join(matchRoom(matchId));
    partnerSocket.join(userRoom(partner.userId));

    joiningSocket.emit('match:found', {
      matchId,
      partner: partnerProfile,
    });
    partnerSocket.emit('match:found', {
      matchId,
      partner: joiningProfile,
    });

    await this.sendHistory(joiningSocket, matchId);
    await this.sendHistory(partnerSocket, matchId);

    logger.info('Mise en relation effectuée.', { matchId });
  }

  /**
   * Envoie l'historique récent de la session au client.
   */
  private async sendHistory(socket: Socket, matchId: string): Promise<void> {
    try {
      const messages = await MessageModel.find({ matchId })
        .sort({ createdAt: -1 })
        .limit(MATCH_HISTORY_LIMIT);

      socket.emit('chat:history', {
        matchId,
        messages: messages.reverse().map((message) => ({
          id: String(message._id),
          matchId: String(message.matchId),
          senderId: String(message.senderId),
          content: message.content,
          createdAt: message.createdAt,
        })),
      });
    } catch (error) {
      logger.error('Impossible de charger l’historique de la session.', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Vérifie qu'un utilisateur participe bien à une session de chat.
   */
  async isParticipant(matchId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(matchId)) {
      return false;
    }

    const match = await MatchModel.findOne({ _id: matchId, status: 'active' }).select(
      'participants',
    );

    if (!match) {
      return false;
    }

    return match.participants.some((participant) => String(participant) === userId);
  }
}
