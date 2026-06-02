import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Permissions } from '../../decorators/permissions.decorator';
import { ROLES } from '../../constants';
import { Permission } from '../../constants/permissions.constant';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { VehiclesService } from '../services/vehicles.service';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { AssignDriverDto } from '../dto/assign-driver.dto';

@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.VEHICLE_OWNER,
  )
  @Permissions(Permission.VEHICLES_WRITE)
  create(@Body() dto: CreateVehicleDto, @CurrentUser() user: AuthenticatedUser) {
    const companyId = dto.companyId ?? user.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : dto.ownerId;
    return this.vehiclesService.create(dto, companyId, ownerId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.vehiclesService.findAll(user.companyId, ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.VEHICLE_OWNER,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.vehiclesService.update(id, dto, ownerId);
  }

  @Patch(':id/assign-driver')
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.VEHICLE_OWNER,
  )
  assignDriver(
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.vehiclesService.assignDriver(id, dto, ownerId);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.VEHICLE_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.vehiclesService.remove(id, ownerId);
  }
}
