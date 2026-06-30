import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BillingPeriod } from '../../common/enums';

export class CreateRazorpayOrderDto {
  @ApiProperty({ description: 'Plan Type (e.g. BASIC, STANDARD)' })
  @IsString()
  @IsNotEmpty()
  planType: string;

  @ApiProperty({ enum: BillingPeriod, description: 'Billing Period (MONTHLY | YEARLY)' })
  @IsEnum(BillingPeriod)
  billingPeriod: BillingPeriod;
}

export class VerifyRazorpayPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  planType: string;

  @ApiProperty({ enum: BillingPeriod })
  @IsEnum(BillingPeriod)
  billingPeriod: BillingPeriod;
}
