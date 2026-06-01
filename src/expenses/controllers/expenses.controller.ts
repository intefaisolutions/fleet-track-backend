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
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('companyId is required to create an expense');
    }
    return this.sService.create(dto, user.companyId, user.userId);
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
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.sService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  remove(@Param('id') id: string) {
    return this.sService.remove(id);
  }
}
