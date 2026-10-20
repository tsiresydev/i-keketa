import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface Message {
  _id: Types.ObjectId;
  matchId: Types.ObjectId;
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDocument = HydratedDocument<Message>;

const messageSchema = new Schema<Message>(
  {
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

messageSchema.index({ matchId: 1, createdAt: 1 });

export const MessageModel: Model<Message> = model<Message>('Message', messageSchema);

export interface MessageDto {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export const toMessageDto = (message: Message): MessageDto => ({
  id: String(message._id),
  matchId: String(message.matchId),
  senderId: String(message.senderId),
  content: message.content,
  createdAt: message.createdAt,
});
