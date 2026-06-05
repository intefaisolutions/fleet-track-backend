import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DriverUpdateProfileDto {
  @ApiProperty({ example: 'Suresh Yadav' })
  @IsString()
  @MinLength(2)
  fullName: string;
}
