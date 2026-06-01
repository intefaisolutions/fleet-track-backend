import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Starter Plus' })
  @IsString()
  @MinLength(2)
  displayName: string;

  @ApiPropertyOptional({ example: 'Mid-size fleets' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(1)
  vehicleLimit: number;

  @ApiProperty({ example: 499 })
  @IsInt()
  @Min(0)
  monthlyPriceInr: number;

  @ApiProperty({ example: 4990 })
  @IsInt()
  @Min(0)
  yearlyPriceInr: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdmins?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOwners?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDrivers?: number;

  @ApiPropertyOptional({ type: [String], example: ['Fuel reports', 'SMS alerts'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  features?: string[];
}
