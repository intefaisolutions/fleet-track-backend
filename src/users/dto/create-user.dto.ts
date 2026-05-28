import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { UserRole, UserStatus } from '../../common/enums';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'john@fleet.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'Password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/user.jpg' })
  @IsOptional()
  @IsUrl()
  profileImage?: string;

  @ApiPropertyOptional({ example: '665f1f9c8e12ab0012345678' })
  @IsOptional()
  @IsMongoId()
  companyId?: string;
}
