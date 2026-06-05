import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class DriverDailyReportDto {
  @ApiProperty({ example: 320 })
  @IsNumber()
  @Min(0)
  totalKm: number;

  @ApiProperty({ example: 'Delhi - Jaipur' })
  @IsString()
  @MinLength(2)
  destination: string;

  @ApiProperty({ example: 4500 })
  @IsNumber()
  @Min(0)
  totalExpense: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-06-05' })
  @IsOptional()
  @IsDateString()
  reportDate?: string;
}
