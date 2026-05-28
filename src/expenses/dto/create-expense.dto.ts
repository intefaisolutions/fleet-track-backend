import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseCategory } from '../../common/enums';

export class CreateExpenseDto {
  @ApiProperty({ example: '665f1f9c8e12ab0012345678' })
  @IsMongoId()
  vehicleId: string;

  @ApiProperty({ enum: ExpenseCategory, example: 'FUEL' })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'Fuel refill' })
  @IsOptional()
  @IsString()
  description?: string;
}
