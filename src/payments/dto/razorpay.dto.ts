import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPeriod } from '../../common/enums';

export class CreateRazorpayOrderDto {
  @ApiProperty({ description: 'Plan Type (e.g. BASIC, STANDARD)' })
  @IsString()
  @IsNotEmpty()
  planType: string;

  @ApiProperty({ enum: BillingPeriod, description: 'Billing Period (MONTHLY | YEARLY)' })
  @IsEnum(BillingPeriod)
  billingPeriod: BillingPeriod;

  @ApiPropertyOptional({
    description: 'Apply wallet balance toward this upgrade. Default true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;
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

  @ApiPropertyOptional({
    description: 'Must match the useWallet flag used when creating the order',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;
}
