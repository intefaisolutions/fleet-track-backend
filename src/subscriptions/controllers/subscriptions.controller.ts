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
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { PlanChangeDto } from '../dto/plan-change.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly sService: SubscriptionsService) {}

  @Post()
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
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
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.sService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  remove(@Param('id') id: string) {
    return this.sService.remove(id);
  }

  @Post('preview-change')
  @Roles(ROLES.COMPANY_ADMIN)
  previewChange(@Body() dto: PlanChangeDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new Error('User does not belong to a company');
    }
    return this.sService.previewPlanChange(user.companyId, dto.newPlanId);
  }

  @Post('change-plan')
  @Roles(ROLES.COMPANY_ADMIN)
  changePlan(@Body() dto: PlanChangeDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new Error('User does not belong to a company');
    }
    return this.sService.changePlan(user.companyId, dto.newPlanId, dto.paymentId);
  }
}
