import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { VehicleStatus, VehicleType } from '../../common/enums';

export class CreateVehicleDto {
  @ApiPropertyOptional({ example: 'MH12AB1234', description: 'Alias for registrationNumber' })
  @ValidateIf((o: CreateVehicleDto) => !o.registrationNumber)
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: 'MH12AB1234' })
  @ValidateIf((o: CreateVehicleDto) => !o.vehicleNumber)
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'Tata' })
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional({ example: 'Tata Ace', description: 'Alias for modelName' })
  @ValidateIf((o: CreateVehicleDto) => !o.modelName)
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'Tata Ace' })
  @ValidateIf((o: CreateVehicleDto) => !o.model)
  @IsString()
  modelName?: string;

  @ApiPropertyOptional({ enum: VehicleType, example: 'TRUCK' })
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional({ description: 'Required when Super Admin creates for a company' })
  @IsOptional()
  @IsMongoId()
  companyId?: string;
}
