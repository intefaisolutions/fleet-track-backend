import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaymentVerificationStatus } from '../../common/enums';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { PaymentsService } from '../services/payments.service';
import { SubmitPaymentDto } from '../dto/submit-payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('submit')
  @Roles(ROLES.COMPANY_ADMIN, ROLES.VEHICLE_OWNER)
  @ApiOperation({ summary: 'Submit manual payment proof (UPI/bank)' })
  submit(@Body() dto: SubmitPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.submit(dto, user.companyId!, user.userId);
  }

  @Get()
  @ApiQuery({ name: 'status', enum: PaymentVerificationStatus, required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: PaymentVerificationStatus,
  ) {
    const companyId = user.role === ROLES.SUPER_ADMIN ? undefined : user.companyId;
    return this.paymentsService.findAll(status, companyId);
  }

  @Patch(':id/verify')
  @Roles(ROLES.SUPER_ADMIN)
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.verify(id, user.userId);
  }

  @Patch(':id/reject')
  @Roles(ROLES.SUPER_ADMIN)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    return this.paymentsService.reject(id, user.userId, rejectionReason);
  }
}
