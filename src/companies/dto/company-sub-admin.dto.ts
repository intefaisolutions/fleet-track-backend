import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsString, MinLength } from 'class-validator';

export class AddCompanySubAdminDto {
  @ApiProperty({ example: 'John Dawson' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'john.dawson@fleettrack.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: ['expenses:read', 'users:read'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
