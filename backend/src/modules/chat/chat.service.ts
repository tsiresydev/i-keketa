import { Types } from 'mongoose';
import { MessageModel, toMessageDto, type MessageDto } from '../../models/message.model';
import { MatchModel } from '../../models/match.model';
import { ApiError } from '../../utils/api-error';

export interface SaveMessageInput {
  matchId: string;
  senderId: string;
  recipientId: string;
  content: string;
}

export const saveMessage = async ({
  matchId,
  senderId,
  recipientId,
  content,
}: SaveMessageInput): Promise<MessageDto> => {
  const message = await MessageModel.create({
    matchId: new Types.ObjectId(matchId),
    senderId: new Types.ObjectId(senderId),
    recipientId: new Types.ObjectId(recipientId),
    content,
  });

  return toMessageDto(message);
};

export const getMatchHistory = async (matchId: string, limit = 100): Promise<MessageDto[]> => {
  const messages = await MessageModel.find({ matchId: new Types.ObjectId(matchId) })
    .sort({ createdAt: 1 })
    .limit(limit);

  return messages.map(toMessageDto);
};

/**
 * Vérifie qu'un utilisateur est bien participant d'une session de chat.
 */
export const assertMatchParticipant = async (matchId: string, userId: string): Promise<void> => {
  if (!Types.ObjectId.isValid(matchId)) {
    throw ApiError.notFound('Session de chat introuvable.');
  }

  const match = await MatchModel.findById(matchId).select('participants');

  if (!match) {
    throw ApiError.notFound('Session de chat introuvable.');
  }

  const isParticipant = match.participants.some((participant) => String(participant) === userId);

  if (!isParticipant) {
    throw ApiError.forbidden('Vous ne participez pas à cette session de chat.');
  }
};
