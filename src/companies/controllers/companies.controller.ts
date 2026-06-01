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
import { CompanyStatus } from '../../common/enums';
import { Public } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { CompaniesService } from '../services/companies.service';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';
import { AddCompanySubAdminDto } from '../dto/company-sub-admin.dto';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Public registration with license key (creates company + COMPANY_ADMIN; currently ACTIVE after valid license)',
  })
  register(@Body() dto: RegisterCompanyDto) {
    return this.companiesService.register(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Super Admin onboard: creates ACTIVE company + COMPANY_ADMIN + FREE subscription',
  })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @ApiQuery({ name: 'status', enum: CompanyStatus, required: false })
  findAll(@Query('status') status?: CompanyStatus) {
    return this.companiesService.findAll(status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me/sub-admins')
  @Roles(ROLES.COMPANY_ADMIN)
  @ApiOperation({ summary: 'List company sub-admins and summary stats' })
  listSubAdmins(@CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('Company context required');
    }
    return this.companiesService.listSubAdmins(user.companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('me/sub-admins')
  @Roles(ROLES.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Invite a company sub-admin' })
  addSubAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCompanySubAdminDto,
  ) {
    if (!user.companyId) {
      throw new BadRequestException('Company context required');
    }
    return this.companiesService.addSubAdmin(user.companyId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('me/sub-admins/:email')
  @Roles(ROLES.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Remove a company sub-admin' })
  removeSubAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('email') email: string,
  ) {
    if (!user.companyId) {
      throw new BadRequestException('Company context required');
    }
    return this.companiesService.removeSubAdmin(user.companyId, email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/approve')
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a pending company registration' })
  approve(@Param('id') id: string) {
    return this.companiesService.approve(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/reject')
  @Roles(ROLES.SUPER_ADMIN)
  reject(@Param('id') id: string) {
    return this.companiesService.reject(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/suspend')
  @Roles(ROLES.SUPER_ADMIN)
  suspend(@Param('id') id: string) {
    return this.companiesService.suspend(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
