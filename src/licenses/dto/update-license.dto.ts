import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateLicenseDto } from './create-license.dto';

export class UpdateLicenseDto extends PartialType(CreateLicenseDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
