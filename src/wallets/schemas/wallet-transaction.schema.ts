import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type WalletTransactionDocument = WalletTransaction & Document;

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

@Schema({ timestamps: true })
export class WalletTransaction {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true })
  reason: string;

  @Prop({ required: true })
  previousBalance: number;

  @Prop({ required: true })
  currentBalance: number;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' })
  referenceSubscriptionId?: Types.ObjectId;

  @Prop()
  referencePlan?: string;

  @Prop()
  description?: string;

  /** Days already used on the previous plan when this credit was generated */
  @Prop()
  usedDays?: number;

  /** Value of days already used (deducted from old plan price) */
  @Prop()
  usedAmount?: number;

  /** Unused days left on previous plan */
  @Prop()
  remainingDays?: number;

  @Prop()
  fromPlan?: string;

  @Prop()
  toPlan?: string;

  /** UPGRADED | DOWNGRADED | RENEWED */
  @Prop()
  changeAction?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);
