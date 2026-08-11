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
import { SupportAdminPermissionsGuard } from '../../guards/support-admin-permissions.guard';
import { Roles } from '../../decorators/roles.decorator';
import { SupportAdminPermissions } from '../../decorators/support-admin-permissions.decorator';
import { ROLES } from '../../constants';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { PaymentsService } from '../services/payments.service';
import { SubmitPaymentDto } from '../dto/submit-payment.dto';
import {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
} from '../dto/razorpay.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SupportAdminPermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('submit')
  @Roles(ROLES.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Submit manual payment proof (UPI / Bank Transfer) — Company Admin only',
  })
  submit(@Body() dto: SubmitPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.submit(dto, user.companyId!, user.userId);
  }

  @Get()
  @Roles(ROLES.SUPER_ADMIN, ROLES.SUPPORT_ADMIN, ROLES.COMPANY_ADMIN, ROLES.VEHICLE_OWNER)
  @SupportAdminPermissions('payments:read', 'payments:write')
  @ApiQuery({ name: 'status', enum: PaymentVerificationStatus, required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: PaymentVerificationStatus,
  ) {
    const platformScope =
      user.role === ROLES.SUPER_ADMIN || user.role === ROLES.SUPPORT_ADMIN;
    const companyId = platformScope ? undefined : user.companyId;
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

  @Post('razorpay/create-order')
  @Roles(ROLES.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Create Razorpay order for plan upgrade — Company Admin only',
  })
  createRazorpayOrder(
    @Body() dto: CreateRazorpayOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createRazorpayOrder(
      dto,
      user.companyId!,
      user.userId,
    );
  }

  @Post('razorpay/verify')
  @Roles(ROLES.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Verify Razorpay payment signature and auto-activate subscription — Company Admin only',
  })
  verifyRazorpayPayment(
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.verifyRazorpayPayment(
      dto,
      user.companyId!,
      user.userId,
    );
  }
}
