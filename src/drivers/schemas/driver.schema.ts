import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DriverStatus } from '../../common/enums';

export type DriverDocument = Driver & Document;

@Schema({ timestamps: true })
export class Driver {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  licenseNumber?: string;

  @Prop({ type: String, enum: DriverStatus, default: DriverStatus.ACTIVE })
  status: DriverStatus;

  @Prop({ type: Types.ObjectId, ref: 'Company', index: true, required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
