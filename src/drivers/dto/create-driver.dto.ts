import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
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

  @ApiProperty({ example: 'DL1420110012345' })
  @IsString()
  @Matches(/^[A-Za-z]{2}[A-Za-z0-9]{6,14}$/, {
    message:
      'License number must start with a 2-letter state code (e.g. DL1420110012345)',
  })
  licenseNumber: string;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
