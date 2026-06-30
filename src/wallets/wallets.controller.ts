import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ROLES } from '../constants';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthenticatedUser } from '../types';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('balance')
  @Roles(ROLES.COMPANY_ADMIN)
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) throw new Error('User does not belong to a company');
    return this.walletsService.getBalance(user.companyId);
  }

  @Get('transactions')
  @Roles(ROLES.COMPANY_ADMIN)
  getMyTransactions(@CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) throw new Error('User does not belong to a company');
    return this.walletsService.getTransactions(user.companyId);
  }

  @Get('admin/transactions')
  @Roles(ROLES.SUPER_ADMIN)
  getAllTransactions() {
    return this.walletsService.getTransactions();
  }
}
