import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'john@fleet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'Password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/john.jpg' })
  @IsOptional()
  @IsUrl()
  profileImage?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.FLEET_MANAGER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'MongoDB company ObjectId' })
  @IsOptional()
  @IsString()
  companyId?: string;
}
