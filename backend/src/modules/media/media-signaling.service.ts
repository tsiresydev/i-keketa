import { Types } from 'mongoose';
import type { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import { CallSessionModel, type CallEndReason } from '../../models/call-session.model';
import type { MatchmakingService } from '../chat/matchmaking.service';
import { matchRoom } from '../chat/matchmaking.service';
/**
 * Codes d'erreur des événements temps réels related à l'audiovisuel.
 */
export const MEDIA_ERROR_CODES = {
  NO_ACTIVE_MATCH: 'NO_ACTIVE_MATCH',
  CALL_ALREADY_ACTIVE: 'CALL_ALREADY_ACTIVE',
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
} as const;

/**
 * Délai au-delà duquel une demande d'appel sans réponse est close.
 */
export const CALL_REQUEST_TIMEOUT_MS = 60_000;

export interface MediaCallState {
  matchId: string;
  audio: boolean;
  video: boolean;
}

/** Appel en cours, suivi pour pouvoir le clore proprement. */
interface ActiveCall {
  sessionId: string;
  callerSocketId: string;
  calleeSocketId: string;
}

export interface MediaRelayService {
  io: Server;
  matchmaking: MatchmakingService;
}

/**
 * Signalisation WebRTC relayée par Socket.IO.
 *
 * Le serveur ne transporte jamais les flux multimédias : il se contente de
 * relayer les descriptions SDP, les candidats ICE et les changements d'état
 * entre les deux participants d'une même session de chat.
 */
export class MediaSignalingService {
  private readonly io: Server;
  private readonly matchmaking: MatchmakingService;
  /** Appels en cours par session de chat. */
  private readonly activeCalls = new Map<string, ActiveCall>();
  /** Expiration des demandes d'appel sans réponse. */
  private readonly pendingTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(io: Server, matchmaking: MatchmakingService) {
    this.io = io;
    this.matchmaking = matchmaking;
  }

  /**
   * Relais un événement au partenaire de l'expéditeur.
   * Renvoie `false` si l'expéditeur n'a pas de session active correspondante.
   */
  private relayToPartner(
    socket: Socket,
    matchId: string,
    event: string,
    payload: unknown,
  ): boolean {
    const user = socket.data.user as { id: string } | undefined;

    if (!user) {
      return false;
    }

    const active = this.matchmaking.getActiveMatch(user.id);

    if (!active || active.matchId !== matchId) {
      return false;
    }

    this.io.to(active.partnerSocketId).emit(event, payload);
    return true;
  }

  /**
   * Démarre une demande d'appel : le partenaire reçoit `media:request`.
   */
  async handleRequest(
    socket: Socket,
    matchId: string,
    audio: boolean,
    video: boolean,
  ): Promise<void> {
    const user = socket.data.user as { id: string } | undefined;

    if (!user) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.NO_ACTIVE_MATCH,
        message: 'Aucune discussion en cours.',
      });
      return;
    }

    const active = this.matchmaking.getActiveMatch(user.id);

    if (!active || active.matchId !== matchId) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.NO_ACTIVE_MATCH,
        message: 'Aucune discussion en cours.',
      });
      return;
    }

    const existing = this.activeCalls.get(matchId);

    if (existing) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.CALL_ALREADY_ACTIVE,
        message: 'Un appel est déjà en cours.',
      });
      return;
    }

    // La session d'appel est réservée avant l'écriture en base : l'appel vidéo
    // étant proposé automatiquement par les deux participants, deux demandes
    // simultanées ne doivent pas créer deux appels concurrents.
    const call: ActiveCall = {
      sessionId: '',
      callerSocketId: socket.id,
      calleeSocketId: active.partnerSocketId,
    };

    this.activeCalls.set(matchId, call);

    try {
      const session = await CallSessionModel.create({
        matchId: new Types.ObjectId(matchId),
        participants: [new Types.ObjectId(user.id), new Types.ObjectId(active.partnerId)],
        status: 'pending',
        audio,
        video,
      });

      call.sessionId = String(session._id);

      // Une demande d'appel sans réponse est close après un délai.
      const timeout = setTimeout(() => {
        void this.expirePendingCall(matchId);
      }, CALL_REQUEST_TIMEOUT_MS);

      timeout.unref();
      this.pendingTimeouts.set(matchId, timeout);
    } catch (error) {
      this.activeCalls.delete(matchId);

      logger.error('Impossible de créer la session d’appel.', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });

      socket.emit('chat:error', {
        code: 'CALL_FAILED',
        message: 'L’appel n’a pas pu être démarré.',
      });
      return;
    }

    this.relayToPartner(socket, matchId, 'media:request', { matchId, audio, video });
    socket.emit('media:requesting', { matchId, audio, video });
  }

  /**
   * Clôture d'une demande d'appel restée sans réponse.
   */
  async expirePendingCall(matchId: string): Promise<void> {
    const call = this.activeCalls.get(matchId);

    if (!call) {
      return;
    }

    if (!call.sessionId) {
      // La session d'appel n'a pas encore été enregistrée : rien à clore.
      this.activeCalls.delete(matchId);
      this.clearPendingTimeout(matchId);
      return;
    }

    const session = await CallSessionModel.findById(call.sessionId).select('status');

    if (session?.status !== 'pending') {
      this.clearPendingTimeout(matchId);
      return;
    }

    this.activeCalls.delete(matchId);
    this.clearPendingTimeout(matchId);

    await CallSessionModel.updateOne(
      { _id: call.sessionId, status: 'pending' },
      { status: 'ended', endedAt: new Date(), endedReason: 'media_failed' },
    );

    this.io.to(call.callerSocketId).emit('media:ended', { matchId, reason: 'media_failed' });
    this.io.to(call.calleeSocketId).emit('media:ended', { matchId, reason: 'media_failed' });
  }

  /**
   * Supprime le minuteur d'expiration d'une demande d'appel.
   */
  private clearPendingTimeout(matchId: string): void {
    const timeout = this.pendingTimeouts.get(matchId);

    if (timeout) {
      clearTimeout(timeout);
      this.pendingTimeouts.delete(matchId);
    }
  }

  /**
   * Le partenaire accepte l'appel : la session passe en « active ».
   */
  async handleAccept(socket: Socket, matchId: string): Promise<void> {
    const user = socket.data.user as { id: string } | undefined;

    if (!user) {
      return;
    }

    const active = this.matchmaking.getActiveMatch(user.id);

    if (!active || active.matchId !== matchId) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.NO_ACTIVE_MATCH,
        message: 'Aucune discussion en cours.',
      });
      return;
    }

    const call = this.activeCalls.get(matchId);

    if (!call || !call.sessionId) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.CALL_NOT_FOUND,
        message: 'Aucun appel en attente.',
      });
      return;
    }

    this.clearPendingTimeout(matchId);

    await CallSessionModel.updateOne(
      { _id: call.sessionId, status: 'pending' },
      { status: 'active', startedAt: new Date() },
    );

    this.relayToPartner(socket, matchId, 'media:accepted', { matchId });
    socket.emit('media:accepted', { matchId });
  }

  /**
   * Relais d'une description SDP (offre ou réponse).
   */
  relayDescription(
    socket: Socket,
    matchId: string,
    description: string,
    event: 'media:offer' | 'media:answer',
  ): void {
    if (!this.relayToPartner(socket, matchId, event, { matchId, description })) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.NO_ACTIVE_MATCH,
        message: 'Aucune discussion en cours.',
      });
    }
  }

  /**
   * Relais d'un candidat ICE.
   */
  relayCandidate(socket: Socket, matchId: string, candidate: string): void {
    if (!this.relayToPartner(socket, matchId, 'media:candidate', { matchId, candidate })) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.NO_ACTIVE_MATCH,
        message: 'Aucune discussion en cours.',
      });
    }
  }

  /**
   * Relais d'un changement d'état (micro / caméra).
   */
  relayState(socket: Socket, state: MediaCallState): void {
    if (!this.relayToPartner(socket, state.matchId, 'media:state', state)) {
      socket.emit('chat:error', {
        code: MEDIA_ERROR_CODES.NO_ACTIVE_MATCH,
        message: 'Aucune discussion en cours.',
      });
    }
  }

  /**
   * Fin d'appel : la session est clôturée et le partenaire prévenu.
   */
  async handleEnd(socket: Socket, matchId: string, reason: CallEndReason): Promise<void> {
    const call = this.activeCalls.get(matchId);

    if (call) {
      this.activeCalls.delete(matchId);
      this.clearPendingTimeout(matchId);

      await CallSessionModel.updateOne(
        { _id: call.sessionId, status: { $ne: 'ended' } },
        { status: 'ended', endedAt: new Date(), endedReason: reason },
      );
    }

    this.relayToPartner(socket, matchId, 'media:ended', { matchId, reason });
  }

  /**
   * Nettoyage lors de la fin d'une session de chat.
   */
  async endCallForMatch(matchId: string, reason: CallEndReason): Promise<void> {
    const call = this.activeCalls.get(matchId);

    if (!call) {
      return;
    }

    if (!call.sessionId) {
      // La session d'appel n'a pas encore été enregistrée : il n'y a rien à
      // clore, seule la réservation est levée.
      this.activeCalls.delete(matchId);
      this.clearPendingTimeout(matchId);

      this.io.to(matchRoom(matchId)).emit('media:ended', { matchId, reason });
      this.io.to(call.callerSocketId).emit('media:ended', { matchId, reason });
      this.io.to(call.calleeSocketId).emit('media:ended', { matchId, reason });
      return;
    }

    this.activeCalls.delete(matchId);
    this.clearPendingTimeout(matchId);

    await CallSessionModel.updateOne(
      { _id: call.sessionId, status: { $ne: 'ended' } },
      { status: 'ended', endedAt: new Date(), endedReason: reason },
    );

    this.io.to(matchRoom(matchId)).emit('media:ended', { matchId, reason });
    this.io.to(call.callerSocketId).emit('media:ended', { matchId, reason });
    this.io.to(call.calleeSocketId).emit('media:ended', { matchId, reason });
  }

  /**
   * Identifiant de la session d'appel active pour une session de chat donnée.
   */
  getActiveCall(matchId: string): string | undefined {
    return this.activeCalls.get(matchId)?.sessionId;
  }
}
