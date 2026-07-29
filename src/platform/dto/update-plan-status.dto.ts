import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePlanStatusDto {
  @ApiProperty({ example: false, description: 'Enable (true) or disable (false) the plan' })
  @IsBoolean()
  isActive: boolean;
}
