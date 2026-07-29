import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LicenseResendLogDocument = LicenseResendLog & Document;

export enum LicenseResendStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true, collection: 'license_resend_logs' })
export class LicenseResendLog {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  requestedBy?: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /** Full key for internal audit (same key is resent, never regenerated). */
  @Prop({ required: true, uppercase: true, trim: true })
  licenseKey: string;

  @Prop({
    type: String,
    enum: LicenseResendStatus,
    required: true,
    index: true,
  })
  status: LicenseResendStatus;

  @Prop({ trim: true })
  errorMessage?: string;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({ trim: true })
  userAgent?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LicenseResendLogSchema =
  SchemaFactory.createForClass(LicenseResendLog);

LicenseResendLogSchema.index({ companyId: 1, createdAt: -1 });
