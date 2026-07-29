import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/** Full update for dynamic subscription plan catalog (does not migrate existing subscribers). */
export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Basic Plan', description: 'Plan Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dataRetentionDays?: number;

  @ApiPropertyOptional({ example: 'Email' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  supportType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  features?: string[];

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdmins?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOwners?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDrivers?: number;

  @ApiPropertyOptional({ example: true, description: 'Enable / disable plan' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
