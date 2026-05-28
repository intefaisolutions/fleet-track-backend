import { IsBoolean, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
