import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BillingPeriod, SubscriptionPlanType, SubscriptionStatus } from '../../common/enums';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, unique: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: String, required: true })
  planType: string;

  @Prop({ type: String, enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Prop({ type: String, enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  billingPeriod: BillingPeriod;

  @Prop({ required: true })
  vehicleLimit: number;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop({ type: Types.ObjectId, ref: 'License' })
  licenseId?: Types.ObjectId;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
