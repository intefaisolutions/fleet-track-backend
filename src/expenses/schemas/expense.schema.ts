import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ExpenseCategory } from '../../common/enums';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ type: Types.ObjectId, ref: 'Company', index: true, required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', index: true, required: true })
  vehicleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  recordedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Driver', index: true })
  driverId?: Types.ObjectId;

  @Prop({ type: String, enum: ExpenseCategory, required: true })
  category: ExpenseCategory;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true })
  expenseDate: Date;

  @Prop({ min: 0 })
  odometerKm?: number;

  @Prop({ trim: true })
  receiptUrl?: string;

  @Prop({ type: Object })
  categoryDetails?: Record<string, unknown>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  /**
   * Client-generated id for offline draft sync.
   * Prevents duplicate uploads when the same draft is synced more than once.
   */
  @Prop({ trim: true, index: true, sparse: true })
  clientRequestId?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index(
  { clientRequestId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { clientRequestId: { $type: 'string' } },
  },
);
