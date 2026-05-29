import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePlanPricingDto {
  @ApiPropertyOptional({ example: 299 })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceInr?: number;

  @ApiPropertyOptional({ example: 2999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearlyPriceInr?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  vehicleLimit?: number;
}
