import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DriverUpdateProfileDto {
  @ApiPropertyOptional({ example: 'Suresh Yadav' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: '9898989898' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  phone?: string;

  @ApiPropertyOptional({ example: '123, Gandhi Nagar, Delhi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/profiles/driver.jpg',
  })
  @IsOptional()
  @IsString()
  profileImage?: string;
}
