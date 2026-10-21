import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

/**
 * Motifs de signalement acceptés.
 */
export const REPORT_REASONS = [
  'harassment',
  'inappropriate_content',
  'nudity',
  'spam',
  'scam',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * Statut d'un signalement.
 *
 * Le workflow de modération (consultation, traitement, sanction) n'est pas
 * implémenté : les signalements sont seulement enregistrés pour un traitement
 * ultérieur. Seul l'état « pending » existe donc.
 */
export const REPORT_STATUSES = ['pending'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface Report {
  _id: Types.ObjectId;
  /** Auteur du signalement. */
  reporterId: Types.ObjectId;
  /** Utilisateur signalé (toujours l'autre participant de la session). */
  reportedId: Types.ObjectId;
  /** Session de chat dans laquelle le comportement a été constaté. */
  matchId: Types.ObjectId;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  /** Nom affiché du partenaire au moment du signalement (figé, non persisté côté User). */
  reportedDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportDocument = HydratedDocument<Report>;

const reportSchema = new Schema<Report>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
      index: true,
    },
    reportedDisplayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Un utilisateur ne peut signaler qu'une fois son partenaire par session.
reportSchema.index({ reporterId: 1, matchId: 1 }, { unique: true });
reportSchema.index({ reportedId: 1, createdAt: -1 });

export const ReportModel: Model<Report> = model<Report>('Report', reportSchema);

export interface ReportDto {
  id: string;
  matchId: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  reportedDisplayName: string;
  createdAt: Date;
}

export const toReportDto = (report: Report): ReportDto => ({
  id: String(report._id),
  matchId: String(report.matchId),
  reason: report.reason,
  ...(report.details ? { details: report.details } : {}),
  status: report.status,
  reportedDisplayName: report.reportedDisplayName,
  createdAt: report.createdAt,
});
