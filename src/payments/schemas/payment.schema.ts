import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BillingPeriod,
  PaymentVerificationStatus,
  SubscriptionPlanType,
} from '../../common/enums';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  submittedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan' })
  planId?: Types.ObjectId;

  // Legacy field
  @Prop()
  planType?: string;

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId?: Types.ObjectId;

  @Prop({ type: String, enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  billingPeriod: BillingPeriod;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 0, min: 0 })
  walletUsed: number;

  @Prop({ trim: true, default: 'INR' })
  currency: string;

  @Prop({ trim: true })
  paymentGateway?: string;

  @Prop({ trim: true })
  invoiceNo?: string;

  @Prop({ required: true, trim: true })
  transactionId: string;

  @Prop({
    type: String,
    enum: PaymentVerificationStatus,
    default: PaymentVerificationStatus.PENDING,
    index: true,
  })
  status: PaymentVerificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy?: Types.ObjectId;

  @Prop()
  verifiedAt?: Date;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
