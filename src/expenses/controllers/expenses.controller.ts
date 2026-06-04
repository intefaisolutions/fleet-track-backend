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
import { ExpensesService } from '../services/expenses.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly sService: ExpensesService) {}

  @Post()
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.VEHICLE_OWNER,
  )
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('companyId is required to create an expense');
    }
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.sService.create(dto, user.companyId, user.userId, ownerId);
  }

  @Get()
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.ACCOUNTANT,
    ROLES.VEHICLE_OWNER,
  )
  findAll(@CurrentUser() user: AuthenticatedUser) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    const allowAllCompanies = user.role === ROLES.SUPER_ADMIN;
    return this.sService.findAll(user.companyId, ownerId, allowAllCompanies);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sService.findOne(id);
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
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.sService.update(id, dto, ownerId);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.VEHICLE_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const ownerId =
      user.role === ROLES.VEHICLE_OWNER ? user.userId : undefined;
    return this.sService.remove(id, ownerId);
  }
}
