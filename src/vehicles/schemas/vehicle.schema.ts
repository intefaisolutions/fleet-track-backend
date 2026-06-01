import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VehicleStatus, VehicleType } from '../../common/enums';

export type VehicleDocument = Vehicle & Document;

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ required: true, trim: true })
  registrationNumber: string;

  @Prop({ required: true, trim: true })
  make: string;

  @Prop({ required: true, trim: true })
  modelName: string;

  @Prop({ trim: true })
  vin?: string;

  @Prop({ trim: true })
  fuelType?: string;

  @Prop({ type: String, enum: VehicleType })
  vehicleType?: VehicleType;

  @Prop({ type: String, enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  status: VehicleStatus;

  @Prop({ type: Types.ObjectId, ref: 'Company', index: true, required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  ownerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Driver', index: true })
  assignedDriverId?: Types.ObjectId;

  @Prop({ min: 0 })
  currentOdometerKm?: number;

  @Prop()
  insuranceExpiry?: Date;

  @Prop()
  pucExpiry?: Date;

  @Prop()
  lastServiceDate?: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.index({ registrationNumber: 1, companyId: 1 }, { unique: true });
