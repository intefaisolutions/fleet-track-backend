import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class DriverDailyReportDto {
  @ApiProperty({ example: 320 })
  @IsNumber()
  @Min(0)
  totalKm: number;

  @ApiProperty({ example: 'Delhi Warehouse' })
  @IsString()
  @MinLength(2)
  startLocation: string;

  @ApiProperty({ example: 'Jaipur Depot' })
  @IsString()
  @MinLength(2)
  endLocation: string;

  @ApiProperty({ example: 'Delivery run' })
  @IsString()
  @MinLength(2)
  purpose: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  /** @deprecated Kept optional for older clients; daily report is not a paid expense. */
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalExpense?: number;

  /** @deprecated Prefer startLocation + endLocation */
  @ApiPropertyOptional({ example: 'Delhi - Jaipur' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({ example: '2026-06-05' })
  @IsOptional()
  @IsDateString()
  reportDate?: string;
}
