import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlatformSettingsDocument = PlatformSettings & Document;

/** Singleton platform config (Company Owner payment details) */
@Schema({ timestamps: true })
export class PlatformSettings {
  @Prop({ required: true, unique: true, default: 'PLATFORM' })
  key: string;

  @Prop({ trim: true })
  upiId?: string;

  @Prop({ trim: true })
  bankAccountNumber?: string;

  @Prop({ trim: true })
  ifscCode?: string;

  @Prop({ trim: true })
  accountHolderName?: string;

  @Prop({ trim: true })
  supportEmail?: string;

  @Prop({ trim: true })
  supportPhone?: string;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        permissions: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  supportAdmins?: { name: string; email: string; permissions: string[] }[];

  /** Applied when auto-calculating yearly plan prices (0–100) */
  @Prop({ default: 20 })
  yearlyDiscountPercent?: number;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
