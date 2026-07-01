import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @IsValidPhoneNumber()
  phone?: string;
}
