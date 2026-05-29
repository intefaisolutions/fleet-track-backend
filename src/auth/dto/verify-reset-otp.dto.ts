import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyResetOtpDto {
  @ApiProperty({ example: 'admin@fleet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
