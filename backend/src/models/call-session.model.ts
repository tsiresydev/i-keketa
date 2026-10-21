import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const CALL_STATUSES = ['pending', 'active', 'ended'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_END_REASONS = [
  'hangup',
  'partner_hangup',
  'partner_disconnected',
  'media_failed',
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

export interface CallSession {
  _id: Types.ObjectId;
  matchId: Types.ObjectId;
  participants: Types.ObjectId[];
  status: CallStatus;
  /** Capacités demandées par le demandeur de l'appel. */
  audio: boolean;
  video: boolean;
  startedAt?: Date;
  endedAt?: Date;
  endedReason?: CallEndReason;
  createdAt: Date;
  updatedAt: Date;
}

export type CallSessionDocument = HydratedDocument<CallSession>;

const callSessionSchema = new Schema<CallSession>(
  {
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      index: true,
    },
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: (participants: Types.ObjectId[]) => participants.length === 2,
        message: 'Un appel doit compter exactement deux participants.',
      },
    },
    status: {
      type: String,
      enum: CALL_STATUSES,
      default: 'pending',
      index: true,
    },
    audio: {
      type: Boolean,
      default: true,
    },
    video: {
      type: Boolean,
      default: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    endedReason: {
      type: String,
      enum: CALL_END_REASONS,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

callSessionSchema.index({ participants: 1, createdAt: -1 });
callSessionSchema.index({ matchId: 1, status: 1 });

export const CallSessionModel: Model<CallSession> = model<CallSession>(
  'CallSession',
  callSessionSchema,
);

export interface CallSessionDto {
  id: string;
  matchId: string;
  status: CallStatus;
  audio: boolean;
  video: boolean;
  startedAt?: Date;
  endedAt?: Date;
  endedReason?: CallEndReason;
  createdAt: Date;
}

export const toCallSessionDto = (session: CallSession): CallSessionDto => ({
  id: String(session._id),
  matchId: String(session.matchId),
  status: session.status,
  audio: session.audio,
  video: session.video,
  ...(session.startedAt ? { startedAt: session.startedAt } : {}),
  ...(session.endedAt ? { endedAt: session.endedAt } : {}),
  ...(session.endedReason ? { endedReason: session.endedReason } : {}),
  createdAt: session.createdAt,
});
