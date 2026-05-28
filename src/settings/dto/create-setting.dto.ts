import { IsBoolean, IsOptional } from 'class-validator';

export class CreateSettingDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
