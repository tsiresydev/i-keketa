import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const MATCH_STATUSES = ['active', 'ended'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_END_REASONS = [
  'user_skipped',
  'partner_disconnected',
  'user_disconnected',
] as const;
export type MatchEndReason = (typeof MATCH_END_REASONS)[number];

export interface Match {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  participantDisplayNames: string[];
  status: MatchStatus;
  endedAt?: Date;
  endedReason?: MatchEndReason;
  createdAt: Date;
  updatedAt: Date;
}

export type MatchDocument = HydratedDocument<Match>;

const matchSchema = new Schema<Match>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: (participants: Types.ObjectId[]) => participants.length === 2,
        message: 'Une session de chat doit compter exactement deux participants.',
      },
    },
    participantDisplayNames: {
      type: [String],
      required: true,
      validate: {
        validator: (names: string[]) => names.length === 2,
        message: 'Une session de chat doit compter exactement deux noms affichés.',
      },
    },
    status: {
      type: String,
      enum: MATCH_STATUSES,
      default: 'active',
      index: true,
    },
    endedAt: {
      type: Date,
    },
    endedReason: {
      type: String,
      enum: MATCH_END_REASONS,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

matchSchema.index({ participants: 1, status: 1 });
matchSchema.index({ status: 1, createdAt: -1 });

export const MatchModel: Model<Match> = model<Match>('Match', matchSchema);
