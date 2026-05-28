import {
  Controller,
  Get,
  Header,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { ReportsService } from '../services/reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Fleet dashboard metrics' })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getDashboard(user.companyId);
  }

  @Get('revenue')
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Expense breakdown by category and month' })
  getRevenue(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getRevenue(user.companyId);
  }

  @Get('export/csv')
  @Roles(
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.FLEET_MANAGER,
    ROLES.ACCOUNTANT,
  )
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="fleet-expenses.csv"')
  @ApiOperation({ summary: 'Export expenses as CSV' })
  async exportCsv(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.exportExpensesCsv(user.companyId);
  }
}
