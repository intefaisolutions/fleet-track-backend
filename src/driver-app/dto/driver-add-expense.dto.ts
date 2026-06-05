import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ExpenseCategory } from '../../common/enums';

export class DriverAddExpenseDto {
  @ApiProperty({ enum: ExpenseCategory, example: 'FUEL' })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'Fuel refill at Indian Oil' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-05' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: 45230 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  odometerKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ description: 'Category-specific fields (litres, station, etc.)' })
  @IsOptional()
  @IsObject()
  categoryDetails?: Record<string, unknown>;
}
