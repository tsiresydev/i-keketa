import { Types } from 'mongoose';
import { ReportModel, toReportDto, type ReportDto } from '../../models/report.model';
import { MatchModel } from '../../models/match.model';
import { UserModel } from '../../models/user.model';
import { ApiError } from '../../utils/api-error';
import { sanitizeText } from '../../utils/text';
import type { ReportCreateInput } from '../../schemas/media.schema';

export interface ReportWithPartner extends ReportDto {
  reportedDisplayName: string;
}

/**
 * Détermine l'autre participant d'une session de chat.
 *
 * Renvoie `null` si l'utilisateur ne participe pas à la session : un tiers
 * ne peut donc pas signaler une session qui ne le concerne pas.
 */
const findPartnerId = async (matchId: string, userId: string): Promise<string | null> => {
  if (!Types.ObjectId.isValid(matchId)) {
    return null;
  }

  const match = await MatchModel.findById(matchId).select('participants status');

  if (!match || match.status !== 'active') {
    return null;
  }

  const isParticipant = match.participants.some((participant) => String(participant) === userId);

  if (!isParticipant) {
    return null;
  }

  const partner = match.participants.find((participant) => String(participant) !== userId);

  return partner ? String(partner) : null;
};

/**
 * Enregistre un signalement d'abus.
 *
 * - L'utilisateur signalé est toujours l'autre participant de la session :
 *   le client ne peut pas désigner une tierce personne.
 * - Un seul signalement par session et par auteur.
 */
export const createReport = async (
  userId: string,
  input: ReportCreateInput,
): Promise<ReportWithPartner> => {
  const partnerId = await findPartnerId(input.matchId, userId);

  if (!partnerId) {
    throw ApiError.notFound('Session de chat introuvable ou clôturée.');
  }

  const existing = await ReportModel.exists({
    reporterId: new Types.ObjectId(userId),
    matchId: new Types.ObjectId(input.matchId),
  });

  if (existing) {
    throw ApiError.conflict('Ce comportement a déjà été signalé pour cette discussion.');
  }

  const details = input.details ? sanitizeText(input.details) : undefined;

  const report = await ReportModel.create({
    reporterId: new Types.ObjectId(userId),
    reportedId: new Types.ObjectId(partnerId),
    matchId: new Types.ObjectId(input.matchId),
    reason: input.reason,
    ...(details ? { details } : {}),
    status: 'pending',
  });

  const partner = await UserModel.findById(partnerId).select('displayName');

  return {
    ...toReportDto(report),
    reportedDisplayName: partner?.displayName ?? 'Anonyme',
  };
};

/**
 * Liste les signalements émis par l'utilisateur courant.
 *
 * La modération n'étant pas implémentée, l'utilisateur ne consulte que ses
 * propres signalements : aucun outil de traitement n'est exposé.
 */
export const listOwnReports = async (userId: string): Promise<ReportWithPartner[]> => {
  const reports = await ReportModel.find({ reporterId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(100);

  const partners = await UserModel.find({
    _id: { $in: reports.map((report) => report.reportedId) },
  }).select('displayName');

  const displayNameById = new Map(
    partners.map((user) => [String(user._id), user.displayName as string]),
  );

  return reports.map((report) => ({
    ...toReportDto(report),
    reportedDisplayName: displayNameById.get(String(report.reportedId)) ?? 'Anonyme',
  }));
};
