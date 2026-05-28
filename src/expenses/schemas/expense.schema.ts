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

  @Prop({ type: String, enum: ExpenseCategory, required: true })
  category: ExpenseCategory;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
