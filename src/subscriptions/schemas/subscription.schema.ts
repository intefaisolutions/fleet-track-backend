import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BillingPeriod, SubscriptionPlanType, SubscriptionStatus } from '../../common/enums';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, unique: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan', required: false })
  planId?: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  originalPrice: number;

  @Prop({ default: 0 })
  walletUsed: number;

  @Prop({ default: 0 })
  amountPaid: number;

  @Prop({ default: 0 })
  remainingCredit: number;

  @Prop({ default: false })
  autoRenew: boolean;

  @Prop({ default: null })
  cancelledAt?: Date;

  @Prop({ type: String, enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Prop({ type: String, enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  billingPeriod: BillingPeriod;

  // Legacy fields to fix TS build errors temporarily during migration
  @Prop()
  planType?: string;

  @Prop()
  vehicleLimit?: number;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop()
  startDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'License' })
  licenseId?: Types.ObjectId;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
