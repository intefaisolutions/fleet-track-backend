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

  @Prop({ type: String, enum: SubscriptionPlanType, required: true })
  planType: SubscriptionPlanType;

  @Prop({ type: String, enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  billingPeriod: BillingPeriod;

  @Prop({ required: true, min: 0 })
  amount: number;

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
