import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionPlanType } from '../../common/enums';
import { Public } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { PlatformService } from '../services/platform.service';
import { UpdatePlatformSettingsDto } from '../dto/update-platform-settings.dto';
import { UpdatePlanPricingDto } from '../dto/update-plan-pricing.dto';

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
  @Get('owner-dashboard')
  @Roles(ROLES.SUPER_ADMIN)
  ownerDashboard() {
    return this.platformService.getOwnerDashboard();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('plans/:planType')
  @Roles(ROLES.SUPER_ADMIN)
  updatePlan(
    @Param('planType') planType: SubscriptionPlanType,
    @Body() dto: UpdatePlanPricingDto,
  ) {
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
}
