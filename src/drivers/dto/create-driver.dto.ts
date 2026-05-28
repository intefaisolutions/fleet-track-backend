import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DriverStatus } from '../../common/enums';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'Suresh Kumar' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'driver@fleet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+917777777777' })
  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'Password@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'DL123456789' })
  @IsString()
  licenseNumber: string;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
