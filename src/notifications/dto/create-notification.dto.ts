import { IsBoolean, IsOptional } from 'class-validator';

export class CreateNotificationDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
