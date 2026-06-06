import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DriverServiceAlertDto {
  @ApiProperty({ example: 'Vehicle needs oil change' })
  @IsString()
  @MinLength(5)
  message: string;

  @ApiPropertyOptional({ example: 'Due at 50,000 km' })
  @IsOptional()
  @IsString()
  notes?: string;
}
