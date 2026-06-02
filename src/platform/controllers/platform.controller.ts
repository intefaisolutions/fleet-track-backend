import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { PlatformService } from '../services/platform.service';
import { UpdatePlatformSettingsDto } from '../dto/update-platform-settings.dto';
import { UpdatePlanPricingDto } from '../dto/update-plan-pricing.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { AddSupportAdminDto } from '../dto/support-admin.dto';

@ApiTags('Platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List subscription plans (public pricing)' })
  getPlans() {
    return this.platformService.getPlans();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('pricing-overview')
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Plans, yearly discount, and subscription stats for pricing UI' })
  pricingOverview() {
    return this.platformService.getPricingOverview();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('dashboard')
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin dashboard — SRS 4.1 (stats, revenue chart, payments, top companies)' })
  superAdminDashboard() {
    return this.platformService.getSuperAdminDashboard();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('owner-dashboard')
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Alias for GET /platform/dashboard (legacy)' })
  ownerDashboard() {
    return this.platformService.getOwnerDashboard();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('plans')
  @Roles(ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a custom subscription plan (Super Admin)' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.platformService.createPlan(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('plans/:planType')
  @Roles(ROLES.SUPER_ADMIN)
  updatePlan(@Param('planType') planType: string, @Body() dto: UpdatePlanPricingDto) {
    return this.platformService.updatePlanPricing(planType, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('payment-settings')
  @Roles(ROLES.SUPER_ADMIN)
  getPaymentSettings() {
    return this.platformService.getPaymentSettings();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('payment-settings')
  @Roles(ROLES.SUPER_ADMIN)
  updatePaymentSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.platformService.updatePaymentSettings(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('support-admins')
  @Roles(ROLES.SUPER_ADMIN)
  getSupportAdmins() {
    return this.platformService.getSupportAdmins();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('support-admins')
  @Roles(ROLES.SUPER_ADMIN)
  addSupportAdmin(@Body() dto: AddSupportAdminDto) {
    return this.platformService.addSupportAdmin(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('support-admins/:email')
  @Roles(ROLES.SUPER_ADMIN)
  removeSupportAdmin(@Param('email') email: string) {
    return this.platformService.removeSupportAdmin(decodeURIComponent(email));
  }
}
