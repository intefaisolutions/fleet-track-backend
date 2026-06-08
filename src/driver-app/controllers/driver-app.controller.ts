import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../decorators/public.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ROLES } from '../../constants/roles.constant';
import { LoginDto } from '../../auth/dto/login.dto';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';
import type { AuthenticatedUser } from '../../types';
import { DriverAppService } from '../services/driver-app.service';
import { DriverAddExpenseDto } from '../dto/driver-add-expense.dto';
import { DriverRepairRequestDto } from '../dto/driver-repair-request.dto';
import { DriverDailyReportDto } from '../dto/driver-daily-report.dto';
import { DriverUpdateProfileDto } from '../dto/driver-update-profile.dto';
import { DriverServiceAlertDto } from '../dto/driver-service-alert.dto';
import { DriverMyExpensesQueryDto } from '../dto/driver-my-expenses-query.dto';
import { DriverUpdateExpenseDto } from '../dto/driver-update-expense.dto';

@ApiTags('Driver App')
@Controller('driver')
export class DriverAppController {
  constructor(private readonly driverAppService: DriverAppService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Driver mobile login (DRIVER role only)' })
  login(@Body() dto: LoginDto) {
    return this.driverAppService.login(dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout driver and revoke refresh token' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.logout(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Get('dashboard')
  @ApiOperation({ summary: 'Driver dashboard — vehicle, today/month stats, recent expenses' })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.getDashboard(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Get('my-vehicle')
  @ApiOperation({ summary: 'Assigned vehicle details for this driver' })
  getMyVehicle(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.getMyVehicle(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Get('owner-details')
  @ApiOperation({ summary: 'Vehicle owner contact details' })
  getOwnerDetails(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.getOwnerDetails(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Get('my-expenses')
  @ApiOperation({ summary: 'View-only expense history with optional date/category filters' })
  getMyExpenses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DriverMyExpensesQueryDto,
  ) {
    return this.driverAppService.getMyExpenses(user, query);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Patch('expenses/:id')
  @ApiOperation({ summary: 'Update an expense recorded by this driver (amount, description, date only)' })
  updateExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DriverUpdateExpenseDto,
  ) {
    return this.driverAppService.updateExpense(user, id, dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('add-expense')
  @ApiOperation({ summary: 'Add fuel / toll / service expense (add only — no edit/delete)' })
  addExpense(@CurrentUser() user: AuthenticatedUser, @Body() dto: DriverAddExpenseDto) {
    return this.driverAppService.addExpense(user, dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('service-alert')
  @ApiOperation({ summary: 'Request service — notifies owner via expense record' })
  serviceAlert(@CurrentUser() user: AuthenticatedUser, @Body() dto: DriverServiceAlertDto) {
    return this.driverAppService.serviceAlert(user, dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('repair-request')
  @ApiOperation({ summary: 'Submit a repair request to the vehicle owner' })
  repairRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: DriverRepairRequestDto) {
    return this.driverAppService.repairRequest(user, dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('daily-report')
  @ApiOperation({ summary: 'Submit end-of-day trip / expense report' })
  dailyReport(@CurrentUser() user: AuthenticatedUser, @Body() dto: DriverDailyReportDto) {
    return this.driverAppService.dailyReport(user, dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Get('profile')
  @ApiOperation({ summary: 'Driver profile with assigned vehicle and owner' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.getProfile(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Put('update-profile')
  @ApiOperation({ summary: 'Update driver display name' })
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: DriverUpdateProfileDto) {
    return this.driverAppService.updateProfile(user, dto);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for logged-in driver' })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.driverAppService.changePassword(user, dto);
  }
}
