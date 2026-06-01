import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Raj Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @IsValidPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  profileImage?: string;
}
