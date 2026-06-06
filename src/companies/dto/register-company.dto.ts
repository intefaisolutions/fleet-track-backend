import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class RegisterCompanyDto {
  @ApiProperty({ example: 'FLT-9A3B-7C2D-8E1F-6G5H' })
  @IsString()
  @MinLength(10)
  licenseKey: string;

  @ApiProperty({ example: 'ABC Logistics' })
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiProperty({ example: 'admin@abc.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'Raj Sharma' })
  @IsString()
  @MinLength(2)
  adminName: string;

  @ApiPropertyOptional({ example: 'Password@123', minLength: 8 })
  @ValidateIf((dto: RegisterCompanyDto) => !dto.googleIdToken)
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ description: 'Google ID token when registering via Continue with Google' })
  @IsOptional()
  @IsString()
  googleIdToken?: string;
}
