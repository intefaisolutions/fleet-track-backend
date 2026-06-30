import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CompanyStatus, SubscriptionPlanType } from '../../common/enums';

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({
    type: String,
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
    index: true,
  })
  status: CompanyStatus;

  @Prop({ type: String, default: SubscriptionPlanType.FREE, index: true })
  planType: string;

  @Prop({ type: Types.ObjectId, ref: 'License', index: true })
  licenseId?: Types.ObjectId;

  @Prop({ default: 5 })
  vehicleLimit: number;

  @Prop({ default: 1 })
  maxAdmins: number;

  @Prop({ default: 5 })
  maxOwners: number;

  @Prop({ default: 15 })
  maxDrivers: number;

  @Prop({ default: 0, min: 0 })
  walletBalance: number;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        permissions: { type: [String], default: [] },
        status: {
          type: String,
          enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
          default: 'PENDING',
        },
        invitedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  subAdmins?: {
    name: string;
    email: string;
    permissions: string[];
    status: string;
    invitedAt?: Date;
  }[];
}

export const CompanySchema = SchemaFactory.createForClass(Company);
