import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LicenseDocument = License & Document;

@Schema({ timestamps: true })
export class License {
  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  companyId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const LicenseSchema = SchemaFactory.createForClass(License);
