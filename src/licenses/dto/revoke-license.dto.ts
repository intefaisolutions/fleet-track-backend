import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RevokeLicenseDto {
  @ApiProperty({ description: 'Grace period in hours before deactivation', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gracePeriodHours?: number;
}
