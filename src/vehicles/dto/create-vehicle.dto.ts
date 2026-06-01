import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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

  @ApiPropertyOptional({ example: 'Diesel' })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({ example: 45200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentOdometerKm?: number;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: 85000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedDriverId?: string;

  @ApiPropertyOptional({ description: 'Required when Super Admin creates for a company' })
  @IsOptional()
  @IsMongoId()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  ownerId?: string;
}
