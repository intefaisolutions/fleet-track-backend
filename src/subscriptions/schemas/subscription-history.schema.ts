import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionHistoryDocument = SubscriptionHistory & Document;

export enum SubscriptionAction {
  CREATED = 'CREATED',
  UPGRADED = 'UPGRADED',
  DOWNGRADED = 'DOWNGRADED',
  RENEWED = 'RENEWED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class SubscriptionHistory {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscriptionId: Types.ObjectId;

  @Prop({ type: String, enum: SubscriptionAction, required: true })
  action: SubscriptionAction;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan' })
  oldPlanId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan' })
  newPlanId?: Types.ObjectId;

  @Prop()
  oldPrice?: number;

  @Prop()
  newPrice?: number;

  @Prop({ default: 0 })
  creditGenerated: number;

  @Prop({ default: 0 })
  walletUsed: number;

  @Prop({ default: 0 })
  paymentCollected: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop()
  notes?: string;
}

export const SubscriptionHistorySchema = SchemaFactory.createForClass(SubscriptionHistory);
