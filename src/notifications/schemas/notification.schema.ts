import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationPushStatus,
  NotificationType,
} from '../../common/enums';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  companyId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({
    type: String,
    enum: NotificationType,
    required: true,
    index: true,
  })
  type: NotificationType;

  @Prop({ default: false, index: true })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;

  @Prop({ trim: true })
  entityType?: string;

  @Prop({ trim: true })
  entityId?: string;

  /** Prevent duplicate expiry / event spam */
  @Prop({ trim: true, index: true, sparse: true })
  dedupeKey?: string;

  @Prop({
    type: [String],
    enum: NotificationChannel,
    default: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
  })
  channels: NotificationChannel[];

  @Prop({
    type: String,
    enum: NotificationPushStatus,
    default: NotificationPushStatus.PENDING,
  })
  pushStatus: NotificationPushStatus;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ companyId: 1, createdAt: -1 });
