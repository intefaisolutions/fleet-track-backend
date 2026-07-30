import { IsEnum, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPeriod } from '../../common/enums';

export class PlanChangeDto {
  @IsMongoId()
  @IsNotEmpty()
  newPlanId: string;

  @IsOptional()
  @IsMongoId()
  paymentId?: string; // Reference to the payment if a top-up was needed

  @ApiPropertyOptional({ enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;
}
