import { IsBoolean, IsOptional } from 'class-validator';

export class CreateLicenseDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
