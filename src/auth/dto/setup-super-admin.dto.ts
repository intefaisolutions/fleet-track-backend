import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class SetupSuperAdminDto {
  @ApiProperty({ description: 'One-time secret from .env SUPER_ADMIN_SETUP_SECRET' })
  @IsString()
  @IsNotEmpty()
  setupSecret: string;

  @ApiProperty({ example: 'Fleet Super Admin' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'admin@fleet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'SuperAdmin@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  profileImage?: string;
}
