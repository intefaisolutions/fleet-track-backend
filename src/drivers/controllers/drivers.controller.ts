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
import { ROLES } from '../../constants';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { DriversService } from '../services/drivers.service';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private readonly sService: DriversService) {}

  @Post()
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  create(@Body() dto: CreateDriverDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('companyId is required to create a driver');
    }
    return this.sService.create(dto, user.companyId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.sService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  remove(@Param('id') id: string) {
    return this.sService.remove(id);
  }
}
