import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { BillingPeriod, PaymentMethodType } from '../../common/enums';

export class SubmitPaymentDto {
  @ApiProperty({ example: 'PREMIUM' })
  @IsString()
  @MinLength(2)
  planType: string;

  @ApiPropertyOptional({ enum: BillingPeriod, default: 'MONTHLY' })
  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @ApiProperty({ example: 299 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'TXN123456789' })
  @IsString()
  @MinLength(4)
  transactionId: string;

  @ApiPropertyOptional({
    enum: PaymentMethodType,
    default: PaymentMethodType.UPI,
    description: 'Manual channel: UPI or BANK_TRANSFER',
  })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
