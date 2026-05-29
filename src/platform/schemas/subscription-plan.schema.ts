import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SubscriptionPlanType } from '../../common/enums';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

@Schema({ timestamps: true })
export class SubscriptionPlan {
  @Prop({ type: String, enum: SubscriptionPlanType, required: true, unique: true })
  planType: SubscriptionPlanType;

  @Prop({ required: true })
  vehicleLimit: number;

  @Prop({ default: 1 })
  maxAdmins: number;

  @Prop({ default: 5 })
  maxOwners: number;

  @Prop({ default: 15 })
  maxDrivers: number;

  @Prop({ default: 0 })
  monthlyPriceInr: number;

  @Prop({ default: 0 })
  yearlyPriceInr: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);
