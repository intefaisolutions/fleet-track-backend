import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsString, MinLength } from 'class-validator';

export class AddSupportAdminDto {
  @ApiProperty({ example: 'Sarah Jenkins' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'sarah@fleettrack.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: ['licenses:read', 'payments:write'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
