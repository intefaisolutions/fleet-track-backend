import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsString, MinLength } from 'class-validator';
import { IsValidPhoneNumber } from '../../common/validators/phone.validator';

export class AddSupportAdminDto {
  @ApiProperty({ example: 'Sarah Jenkins' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'sarah@fleettrack.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ example: 'Support@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: ['licenses:read', 'payments:write'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateSupportAdminPermissionsDto {
  @ApiProperty({ example: ['licenses:read', 'payments:write'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
