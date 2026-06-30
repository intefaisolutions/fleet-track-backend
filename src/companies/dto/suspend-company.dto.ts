import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SuspendCompanyDto {
  @ApiProperty({ description: 'Reason for suspending the company' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
