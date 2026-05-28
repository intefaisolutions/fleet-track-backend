import {
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
import { SettingsService } from '../services/settings.service';
import { CreateSettingDto } from '../dto/create-setting.dto';
import { UpdateSettingDto } from '../dto/update-setting.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly sService: SettingsService) {}

  @Post()
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  create(@Body() dto: CreateSettingDto, @CurrentUser() user: AuthenticatedUser) {
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
  update(@Param('id') id: string, @Body() dto: UpdateSettingDto) {
    return this.sService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  remove(@Param('id') id: string) {
    return this.sService.remove(id);
  }
}
