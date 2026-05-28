import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({ example: 'admin@fleet.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Token received via email (or dev response)' })
  @IsString()
  token: string;

  @ApiPropertyOptional({ example: 'NewPassword@123', minLength: 8 })
  @ValidateIf((o: ResetPasswordDto) => !o.newPassword)
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 'NewPassword@123', minLength: 8 })
  @ValidateIf((o: ResetPasswordDto) => !o.password)
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
