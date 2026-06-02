import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';
import { LicenseKeyStatus } from '../../common/enums';
import { Public } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { LicensesService } from '../services/licenses.service';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';

class ExtendLicenseDto {
  @Type(() => Date)
  @IsDate()
  validUntil: Date;
}

@ApiTags('Licenses')
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Public()
  @Get('validate')
  @ApiOperation({ summary: 'Validate license key before registration (public)' })
  @ApiQuery({ name: 'key', required: true })
  validateKey(@Query('key') key: string) {
    if (!key?.trim()) {
      throw new BadRequestException('License key is required');
    }
    return this.licensesService.validateKeyPublic(key);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate a new license key (Super Admin)' })
  create(@Body() dto: CreateLicenseDto) {
    return this.licensesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(ROLES.SUPER_ADMIN)
  @ApiQuery({ name: 'status', enum: LicenseKeyStatus, required: false })
  findAll(@Query('status') status?: LicenseKeyStatus) {
    return this.licensesService.findAll(status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(ROLES.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.licensesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/revoke')
  @Roles(ROLES.SUPER_ADMIN)
  revoke(@Param('id') id: string) {
    return this.licensesService.revoke(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/extend')
  @Roles(ROLES.SUPER_ADMIN)
  extend(@Param('id') id: string, @Body() dto: ExtendLicenseDto) {
    return this.licensesService.extend(id, dto.validUntil);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/cancel')
  @Roles(ROLES.SUPER_ADMIN)
  cancel(@Param('id') id: string) {
    return this.licensesService.cancel(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/send-email')
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Email license key to contact' })
  sendEmail(@Param('id') id: string) {
    return this.licensesService.sendLicenseEmail(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(ROLES.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLicenseDto) {
    return this.licensesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.licensesService.remove(id);
  }
}
