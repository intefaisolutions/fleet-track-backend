import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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

  @ApiProperty({
    example: 'TXN123456789',
    description: 'UPI Transaction ID or Bank UTR / reference number',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9/_-]+$/, {
    message:
      'Transaction ID can only contain letters, numbers, -, _ and /',
  })
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

  @ApiProperty({
    description: 'When the payment was made (ISO date-time) — required for manual UPI/Bank',
  })
  @IsDateString()
  paidAt: string;

  @ApiProperty({
    description: 'Payment screenshot / receipt URL — required for manual UPI/Bank',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  proofUrl: string;

  @ApiPropertyOptional({
    description: 'Apply wallet toward plan on approval. Default true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;
}
