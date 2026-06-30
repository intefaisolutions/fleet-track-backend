import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class PlanChangeDto {
  @IsMongoId()
  @IsNotEmpty()
  newPlanId: string;

  @IsOptional()
  @IsMongoId()
  paymentId?: string; // Reference to the payment if a top-up was needed
}
