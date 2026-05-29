import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { SubscriptionPlanType } from '../../common/enums';

export class CreateLicenseDto {
  @ApiPropertyOptional({ example: 'ABC Transport Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  intendedCompanyName?: string;

  @ApiPropertyOptional({ example: 'contact@abctransport.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ enum: SubscriptionPlanType, example: 'PREMIUM' })
  @IsEnum(SubscriptionPlanType)
  planType: SubscriptionPlanType;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdmins?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOwners?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDrivers?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxVehicles?: number;

  @ApiProperty({ example: '2026-12-31' })
  @Type(() => Date)
  @IsDate()
  validUntil: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
