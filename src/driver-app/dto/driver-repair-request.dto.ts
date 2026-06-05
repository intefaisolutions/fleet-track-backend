import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DriverRepairRequestDto {
  @ApiProperty({ example: 'Engine Noise' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiProperty({ example: 'Loud knocking sound when accelerating' })
  @IsString()
  @MinLength(5)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
