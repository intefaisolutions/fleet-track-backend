import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';
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

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @IsValidPhoneNumber()
  contactPhone?: string;

  @ApiProperty({ example: 'PREMIUM' })
  @IsString()
  @MinLength(2)
  planType: string;

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
