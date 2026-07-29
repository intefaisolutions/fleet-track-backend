import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreatePlanDto {
  @ApiProperty({ example: 'Starter Plus', description: 'Plan Name' })
  @IsString()
  @MinLength(2)
  displayName: string;

  @ApiPropertyOptional({ example: 'Mid-size fleets' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 25, description: 'Vehicle Limit' })
  @IsInt()
  @Min(1)
  vehicleLimit: number;

  @ApiProperty({ example: 499, description: 'Monthly Price (INR)' })
  @IsInt()
  @Min(0)
  monthlyPriceInr: number;

  @ApiProperty({ example: 4990, description: 'Yearly Price (INR)' })
  @IsInt()
  @Min(0)
  yearlyPriceInr: number;

  @ApiPropertyOptional({ example: 30, description: 'Data retention in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dataRetentionDays?: number;

  @ApiPropertyOptional({
    example: 'Email',
    description: 'Support Type (Community, Email, Chat + Email, …)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  supportType?: string;

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
  @ArrayMaxSize(20)
  features?: string[];

  @ApiPropertyOptional({ example: true, description: 'Status — active for new subscriptions' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
