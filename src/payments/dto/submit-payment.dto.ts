import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { BillingPeriod } from '../../common/enums';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
