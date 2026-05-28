import { IsBoolean, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
