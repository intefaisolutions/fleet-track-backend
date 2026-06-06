import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ExpenseCategory } from '../../common/enums';

export class DriverMyExpensesQueryDto {
  @ApiPropertyOptional({ enum: ExpenseCategory, example: 'FUEL' })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: '2026-03', description: 'Filter by month (YYYY-MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}
