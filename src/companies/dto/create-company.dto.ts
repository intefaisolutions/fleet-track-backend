import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyStatus } from '../../common/enums';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'ABC Transport Pvt Ltd' })
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  name: string;

  @ApiProperty({ example: 'contact@abctransport.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @MinLength(2)
  adminFullName: string;

  @ApiProperty({ example: 'Password@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
