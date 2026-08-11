import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCompanySubAdminDto {
  @ApiPropertyOptional({ example: 'Payal Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: ['users:read', 'vehicles:write'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
