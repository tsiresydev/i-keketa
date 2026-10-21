import { Types } from 'mongoose';
import type { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import { MatchModel, type MatchEndReason } from '../../models/match.model';
import { MessageModel } from '../../models/message.model';
import { UserModel } from '../../models/user.model';

/**
 * Identité minimale d'un utilisateur connecté, transmise via `socket.data.user`.
 */
export interface SocketIdentity {
  id: string;
  pseudonym: string;
  displayName?: string;
  photoUrl?: string;
}

/**
 * Profil du partenaire transmis au client lors d'une mise en relation.
 * Le nom affiché et la photo ne sont présents que s'ils ont été renseignés.
 */
export interface PartnerProfile {
  pseudonym: string;
  displayName?: string;
  photoUrl?: string;
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
  partnerPseudonym: string;
  partnerDisplayName?: string;
  partnerPhotoUrl?: string;
}

export const MATCH_HISTORY_LIMIT = 100;

export const CHAT_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  USER_UNAVAILABLE: 'USER_UNAVAILABLE',
} as const;

/**
 * Service de mise en relation (aléatoire et directe).
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
        pseudonym: user.pseudonym,
        ...(user.displayName ? { displayName: user.displayName } : {}),
        ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
      });
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
   * Démarre une discussion directe avec un utilisateur ciblé.
   *
   * La cible doit être connectée et libre (sans discussion en cours).
   * Dans le cas contraire, l'erreur `USER_UNAVAILABLE` est renvoyée au demandeur.
   */
  async startDirectChat(socket: Socket, targetUserId: string): Promise<void> {
    const user = socket.data.user as SocketIdentity | undefined;

    if (!user) {
      socket.emit('chat:error', {
        code: CHAT_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentification requise.',
      });
      return;
    }

    if (!Types.ObjectId.isValid(targetUserId) || targetUserId === user.id) {
      socket.emit('chat:error', {
        code: CHAT_ERROR_CODES.USER_UNAVAILABLE,
        message: 'Cet utilisateur ne peut pas être contacté.',
      });
      return;
    }

    const targetSocket = this.socketsByUser.get(targetUserId);

    if (!targetSocket) {
      socket.emit('chat:error', {
        code: CHAT_ERROR_CODES.USER_UNAVAILABLE,
        message: 'Cet utilisateur n’est pas connecté actuellement.',
      });
      return;
    }

    if (this.activeMatches.has(targetUserId)) {
      socket.emit('chat:error', {
        code: CHAT_ERROR_CODES.USER_UNAVAILABLE,
        message: 'Cet utilisateur est déjà en discussion.',
      });
      return;
    }

    // Le demandeur quitte sa session précédente et la file d'attente.
    if (this.activeMatches.has(user.id)) {
      await this.endMatch(user.id, 'user_skipped');
    }

    this.leaveQueue(user.id);
    this.leaveQueue(targetUserId);

    const targetIdentity = targetSocket.data.user as SocketIdentity | undefined;

    if (!targetIdentity) {
      socket.emit('chat:error', {
        code: CHAT_ERROR_CODES.USER_UNAVAILABLE,
        message: 'Cet utilisateur n’est pas connecté actuellement.',
      });
      return;
    }

    await this.establishMatch(socket, targetSocket, {
      userId: targetUserId,
      pseudonym: targetIdentity.pseudonym,
      ...(targetIdentity.displayName ? { displayName: targetIdentity.displayName } : {}),
      ...(targetIdentity.photoUrl ? { photoUrl: targetIdentity.photoUrl } : {}),
    });

    logger.info('Discussion directe démarrée.', { requesterId: user.id, targetUserId });
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

    const [joiningProfile, partnerProfile] = await Promise.all([
      this.loadProfile(joiningUser.id),
      this.loadProfile(partner.userId),
    ]);

    let match;

    try {
      match = await MatchModel.create({
        participants: [new Types.ObjectId(joiningUser.id), new Types.ObjectId(partner.userId)],
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
      partnerPseudonym: partnerProfile.pseudonym,
      ...(partnerProfile.displayName ? { partnerDisplayName: partnerProfile.displayName } : {}),
      ...(partnerProfile.photoUrl ? { partnerPhotoUrl: partnerProfile.photoUrl } : {}),
    });
    this.activeMatches.set(partner.userId, {
      matchId,
      partnerId: joiningUser.id,
      partnerSocketId: joiningSocket.id,
      partnerPseudonym: joiningProfile.pseudonym,
      ...(joiningProfile.displayName ? { partnerDisplayName: joiningProfile.displayName } : {}),
      ...(joiningProfile.photoUrl ? { partnerPhotoUrl: joiningProfile.photoUrl } : {}),
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
   * Relit le profil public d'un utilisateur en base (nom affiché, photo).
   * Les valeurs absentes sont omises : l'anonymat par défaut est préservé.
   */
  private async loadProfile(userId: string): Promise<PartnerProfile> {
    try {
      const user = await UserModel.findById(userId).select('pseudonym displayName photoUrl');

      if (!user) {
        return { pseudonym: 'Anonyme' };
      }

      return {
        pseudonym: user.pseudonym,
        ...(user.displayName ? { displayName: user.displayName } : {}),
        ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
      };
    } catch (error) {
      logger.error('Impossible de charger le profil du partenaire.', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return { pseudonym: 'Anonyme' };
    }
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
