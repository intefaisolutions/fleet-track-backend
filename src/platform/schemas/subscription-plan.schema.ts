import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

@Schema({ timestamps: true })
export class SubscriptionPlan {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  planType: string;

  /** Plan Name shown in UI / billing */
  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [String], default: [] })
  features?: string[];

  /** e.g. Community, Email, Chat + Email, Priority Chat, 24x7 Phone */
  @Prop({ trim: true, default: 'Community' })
  supportType?: string;

  /** Expense/report data retention window in days (365+ = long-term / 1 year+) */
  @Prop({ default: 7, min: 1 })
  dataRetentionDays?: number;

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

  /** Enable / disable for new subscriptions (existing subscribers keep their plan) */
  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);
