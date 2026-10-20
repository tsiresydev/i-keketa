import { Types } from 'mongoose';
import type { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import { MatchModel, type MatchEndReason } from '../../models/match.model';
import { MessageModel } from '../../models/message.model';
import { UserModel } from '../../models/user.model';

export const matchRoom = (matchId: string): string => `match:${matchId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

export interface WaitingEntry {
  userId: string;
  socketId: string;
  pseudonym: string;
}

export interface ActiveMatch {
  matchId: string;
  partnerId: string;
  partnerSocketId: string;
  partnerPseudonym: string;
}

export const MATCH_HISTORY_LIMIT = 100;

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

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Place l'utilisateur dans la file d'attente et tente de former un duo.
   * Le partenaire est choisi de manière aléatoire parmi les utilisateurs en attente.
   */
  async joinQueue(socket: Socket): Promise<void> {
    const user = socket.data.user as { id: string; pseudonym: string } | undefined;

    if (!user) {
      socket.emit('chat:error', { code: 'UNAUTHORIZED', message: 'Authentification requise.' });
      return;
    }

    // Un utilisateur déjà en discussion quitte sa session avant de rejoindre la file.
    if (this.activeMatches.has(user.id)) {
      await this.endMatch(user.id, 'user_skipped');
    }

    this.leaveQueue(user.id);

    const partner = this.pickRandomPartner(user.id);

    if (!partner) {
      this.waiting.push({ userId: user.id, socketId: socket.id, pseudonym: user.pseudonym });
      socket.emit('queue:status', { status: 'waiting', position: this.waiting.length });
      logger.info('Utilisateur en attente de partenaire.', { userId: user.id });
      return;
    }

    await this.createMatch(socket, partner);
  }

  /**
   * Retire l'utilisateur de la file d'attente.
   */
  leaveQueue(userId: string): void {
    const index = this.waiting.findIndex((entry) => entry.userId === userId);

    if (index >= 0) {
      this.waiting.splice(index, 1);
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

    if (this.activeMatches.has(user.id)) {
      await this.endMatch(user.id, 'partner_disconnected');
    }

    if (wasWaiting) {
      logger.info('Utilisateur déconnecté de la file d’attente.', { userId: user.id });
    }
  }

  /**
   * Statistiques de la file d'attente (diagnostic).
   */
  getQueueSize(): number {
    return this.waiting.length;
  }

  /**
   * Sélectionne aléatoirement un partenaire parmi les utilisateurs en attente
   * et le retire immédiatement de la file (évite qu'il soit retenu par une
   * autre mise en relation concurente).
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

  private async createMatch(joiningSocket: Socket, partner: WaitingEntry): Promise<void> {
    const joiningUser = joiningSocket.data.user as { id: string; pseudonym: string };

    let match;

    try {
      match = await MatchModel.create({
        participants: [new Types.ObjectId(joiningUser.id), new Types.ObjectId(partner.userId)],
        status: 'active',
      });
    } catch (error) {
      // La session n'a pas pu être créée : le partenaire est replacé dans la file d'attente.
      this.waiting.push(partner);
      logger.error('Impossible de créer la session de chat.', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const matchId = String(match._id);
    const partnerSocket = this.io.sockets.sockets.get(partner.socketId);

    this.activeMatches.set(joiningUser.id, {
      matchId,
      partnerId: partner.userId,
      partnerSocketId: partner.socketId,
      partnerPseudonym: partner.pseudonym,
    });
    this.activeMatches.set(partner.userId, {
      matchId,
      partnerId: joiningUser.id,
      partnerSocketId: joiningSocket.id,
      partnerPseudonym: joiningUser.pseudonym,
    });

    this.leavePreviousMatchRooms(joiningSocket);
    joiningSocket.join(matchRoom(matchId));
    joiningSocket.join(userRoom(joiningUser.id));

    if (partnerSocket) {
      this.leavePreviousMatchRooms(partnerSocket);
      partnerSocket.join(matchRoom(matchId));
      partnerSocket.join(userRoom(partner.userId));
    }

    joiningSocket.emit('match:found', {
      matchId,
      partner: { pseudonym: partner.pseudonym },
    });
    partnerSocket?.emit('match:found', {
      matchId,
      partner: { pseudonym: joiningUser.pseudonym },
    });

    await this.sendHistory(joiningSocket, matchId);
    if (partnerSocket) {
      await this.sendHistory(partnerSocket, matchId);
    }

    logger.info('Mise en relation aléatoire effectuée.', { matchId });
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
   * Récupère le pseudonyme du partenaire d'un match (utile pour les tests).
   */
  async getPartnerPseudonym(userId: string): Promise<string | null> {
    const active = this.activeMatches.get(userId);
    return active?.partnerPseudonym ?? null;
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

  /**
   * Recherche le pseudonyme d'un utilisateur (utilisé par le contrôleur d'historique).
   */
  async getPseudonym(userId: string): Promise<string | null> {
    const user = await UserModel.findById(userId).select('pseudonym');
    return user?.pseudonym ?? null;
  }
}
