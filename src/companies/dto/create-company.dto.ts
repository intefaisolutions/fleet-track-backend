import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CompanyStatus } from '../../common/enums';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsValidPhoneNumber()
  phone: string;

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
}
