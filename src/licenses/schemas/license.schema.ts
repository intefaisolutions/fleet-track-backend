import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LicenseKeyStatus } from '../../common/enums';

export type LicenseDocument = License & Document;

@Schema({ timestamps: true })
export class License {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  licenseKey: string;

  @Prop({ trim: true })
  intendedCompanyName?: string;

  @Prop({ trim: true, lowercase: true })
  contactEmail?: string;

  @Prop({ type: String, required: true, uppercase: true, trim: true })
  planType: string;

  @Prop({ default: 3 })
  maxAdmins: number;

  @Prop({ default: 10 })
  maxOwners: number;

  @Prop({ default: 50 })
  maxDrivers: number;

  @Prop({ default: 5 })
  maxVehicles: number;

  @Prop({ required: true })
  validUntil: Date;

  @Prop({
    type: String,
    enum: LicenseKeyStatus,
    default: LicenseKeyStatus.UNUSED,
    index: true,
  })
  status: LicenseKeyStatus;

  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  companyId?: Types.ObjectId;

  @Prop()
  usedAt?: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ trim: true })
  notes?: string;
}

export const LicenseSchema = SchemaFactory.createForClass(License);
