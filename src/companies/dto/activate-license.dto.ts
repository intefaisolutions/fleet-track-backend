import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @ApiProperty({
    example: 'FLT-9A3B-7C2D-8E1F-6G5H',
    description: 'License key received by email',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(40)
  licenseKey: string;
}
