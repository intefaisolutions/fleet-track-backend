import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

@Schema({ timestamps: true })
export class SubscriptionPlan {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  planType: string;

  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [String], default: [] })
  features?: string[];

  @Prop({ default: false })
  isSystem: boolean;

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
