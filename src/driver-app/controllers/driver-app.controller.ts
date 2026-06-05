import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../decorators/public.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ROLES } from '../../constants/roles.constant';
import { LoginDto } from '../../auth/dto/login.dto';
import type { AuthenticatedUser } from '../../types';
import { DriverAppService } from '../services/driver-app.service';
import { DriverAddExpenseDto } from '../dto/driver-add-expense.dto';
import { DriverRepairRequestDto } from '../dto/driver-repair-request.dto';
import { DriverDailyReportDto } from '../dto/driver-daily-report.dto';
import { DriverUpdateProfileDto } from '../dto/driver-update-profile.dto';

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
  @Get('dashboard')
  @ApiOperation({ summary: 'Driver dashboard — vehicle, stats, recent expenses' })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.getDashboard(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Get('my-expenses')
  @ApiOperation({ summary: 'List expenses recorded by this driver' })
  getMyExpenses(@CurrentUser() user: AuthenticatedUser) {
    return this.driverAppService.getMyExpenses(user);
  }

  @ApiBearerAuth()
  @Roles(ROLES.DRIVER)
  @Post('add-expense')
  @ApiOperation({ summary: 'Add fuel / toll / service expense for assigned vehicle' })
  addExpense(@CurrentUser() user: AuthenticatedUser, @Body() dto: DriverAddExpenseDto) {
    return this.driverAppService.addExpense(user, dto);
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
  @ApiOperation({ summary: 'Driver profile with assigned vehicle' })
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
}
