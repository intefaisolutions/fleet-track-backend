import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');
import {
  BillingPeriod,
  NotificationType,
  PaymentMethodType,
  PaymentVerificationStatus,
  SubscriptionPlanType,
  SubscriptionStatus,
  UserRole,
} from '../../common/enums';
import { DEFAULT_PLAN_LIMITS } from '../../common/constants/plan-limits.constant';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../../platform/schemas/subscription-plan.schema';
import { ResponseService } from '../../common/responses/response.service';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../../subscriptions/schemas/subscription.schema';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { SubmitPaymentDto } from '../dto/submit-payment.dto';
import {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
} from '../dto/razorpay.dto';
import { addBillingPeriod } from '../../common/utils/billing-period.util';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly responseService: ResponseService,
    private readonly subscriptionsService: SubscriptionsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private async superAdminIds(): Promise<string[]> {
    const admins = await this.userModel
      .find({ role: UserRole.SUPER_ADMIN })
      .select('_id')
      .lean();
    return admins.map((a) => a._id.toString());
  }

  private async companyAdminIds(companyId: string): Promise<string[]> {
    const admins = await this.userModel
      .find({ companyId, role: UserRole.COMPANY_ADMIN })
      .select('_id')
      .lean();
    return admins.map((a) => a._id.toString());
  }

  private assertRazorpayConfigured() {
    if (!process.env.RAZORPAY_KEY_ID?.trim() || !process.env.RAZORPAY_KEY_SECRET?.trim()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Please use Manual UPI or Bank Transfer, or contact support.',
      );
    }
  }

  private get razorpayInstance() {
    this.assertRazorpayConfigured();
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  private async resolvePlanLimits(planType: string) {
    const normalized = planType.toUpperCase().trim();
    const plan = await this.planModel.findOne({ planType: normalized, isActive: true });
    if (plan) {
      return {
        vehicleLimit: plan.vehicleLimit,
        maxAdmins: plan.maxAdmins,
        maxOwners: plan.maxOwners,
        maxDrivers: plan.maxDrivers,
        planId: plan._id as Types.ObjectId,
      };
    }

    const fallback = DEFAULT_PLAN_LIMITS[normalized as SubscriptionPlanType];
    if (fallback) {
      return { ...fallback, planId: undefined as Types.ObjectId | undefined };
    }

    throw new BadRequestException(`Plan "${normalized}" not found`);
  }

  /**
   * Apply plan limits to company + upsert ACTIVE subscription.
   * Does not change an already-verified payment document.
   * Existing subscribers keep access; this only upgrades after a successful payment.
   */
  private async activateCompanyPlan(
    companyId: Types.ObjectId | string,
    planType: string,
    billingPeriod: BillingPeriod,
    planId?: Types.ObjectId,
  ) {
    const limits = await this.resolvePlanLimits(planType);
    const startDate = new Date();
    const currentPeriodEnd = addBillingPeriod(startDate, billingPeriod);

    await this.companyModel.findByIdAndUpdate(companyId, {
      planType,
      vehicleLimit: limits.vehicleLimit,
      maxAdmins: limits.maxAdmins,
      maxOwners: limits.maxOwners,
      maxDrivers: limits.maxDrivers,
    });

    await this.subscriptionModel.findOneAndUpdate(
      { companyId },
      {
        planType,
        planId: planId ?? limits.planId,
        status: SubscriptionStatus.ACTIVE,
        vehicleLimit: limits.vehicleLimit,
        billingPeriod,
        startDate,
        currentPeriodEnd,
      },
      { upsert: true },
    );
  }

  async submit(dto: SubmitPaymentDto, companyId: string, userId: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const method = dto.paymentMethod ?? PaymentMethodType.UPI;
    if (
      method !== PaymentMethodType.UPI &&
      method !== PaymentMethodType.BANK_TRANSFER
    ) {
      throw new BadRequestException(
        'Manual submit only supports UPI or Bank Transfer. Use Razorpay checkout for online payments.',
      );
    }

    const txnId = dto.transactionId.trim().toUpperCase();
    if (method === PaymentMethodType.BANK_TRANSFER) {
      const utr = txnId.replace(/\s+/g, '');
      if (utr.length < 8 || utr.length > 30 || !/^[A-Z0-9]+$/.test(utr)) {
        throw new BadRequestException(
          'Enter a valid bank UTR / reference (8–30 letters and numbers)',
        );
      }
    } else if (txnId.length < 8 || txnId.length > 40 || !/^[A-Z0-9/_-]+$/.test(txnId)) {
      throw new BadRequestException(
        'Enter a valid UPI Transaction ID (8–40 characters)',
      );
    }

    if (!dto.paidAt) {
      throw new BadRequestException('Payment date & time is required');
    }
    const paidAtDate = new Date(dto.paidAt);
    if (Number.isNaN(paidAtDate.getTime())) {
      throw new BadRequestException('Invalid payment date & time');
    }
    if (paidAtDate.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException('Payment date cannot be in the future');
    }
    if (paidAtDate.getTime() < Date.now() - 60 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Payment date cannot be older than 60 days');
    }

    const proofUrl = dto.proofUrl?.trim();
    if (!proofUrl) {
      throw new BadRequestException(
        'Payment screenshot / receipt is required for manual UPI and bank transfer',
      );
    }

    const planType = dto.planType.toUpperCase().trim();
    const plan = await this.planModel.findOne({ planType, isActive: true });

    const created = await this.paymentModel.create({
      planType,
      planId: plan?._id,
      billingPeriod: dto.billingPeriod ?? BillingPeriod.MONTHLY,
      amount: dto.amount,
      transactionId: txnId.replace(/\s+/g, ''),
      notes: dto.notes?.trim(),
      paymentMethod: method,
      paymentGateway: 'MANUAL',
      companyId,
      submittedBy: userId,
      status: PaymentVerificationStatus.PENDING,
      paidAt: paidAtDate,
      proofUrl,
    });

    try {
      const company = await this.companyModel.findById(companyId).select('name');
      const adminIds = await this.superAdminIds();
      await this.notificationsService?.notify({
        userIds: adminIds,
        companyId,
        type: NotificationType.PAYMENT_VERIFICATION,
        title: 'Payment pending verification',
        message: `${company?.name ?? 'A company'} submitted a ${method} payment of ₹${dto.amount} for ${planType}. Review required before subscription activates.`,
        entityType: 'payment',
        entityId: created._id.toString(),
        meta: {
          amount: dto.amount,
          planType,
          status: PaymentVerificationStatus.PENDING,
          paymentMethod: method,
        },
      });
    } catch (err) {
      this.logger.warn('Payment notification failed', err);
    }

    return this.responseService.created(
      'Payment request submitted. Status: Pending Verification. Your plan will activate only after Super Admin approval.',
      created,
    );
  }

  async findAll(status?: PaymentVerificationStatus, companyId?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (companyId) filter.companyId = companyId;

    const items = await this.paymentModel
      .find(filter)
      .populate('companyId', 'name email planType phone')
      .populate('submittedBy', 'fullName email phone')
      .populate('verifiedBy', 'fullName email')
      .sort({ createdAt: -1 });

    return this.responseService.success('Payments fetched successfully', items);
  }

  async verify(id: string, verifiedBy: string) {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentVerificationStatus.PENDING) {
      throw new BadRequestException('Payment is not pending verification');
    }

    // Only manual payment requests are approved here (Razorpay auto-verifies)
    if (payment.paymentGateway && payment.paymentGateway !== 'MANUAL') {
      throw new BadRequestException(
        'Only manual UPI / Bank Transfer requests can be approved here',
      );
    }

    const planType = (payment.planType || '').toUpperCase().trim();
    if (!planType) {
      throw new BadRequestException('Payment has no plan type');
    }

    const billingPeriod = payment.billingPeriod ?? BillingPeriod.MONTHLY;
    let planId = payment.planId;
    if (!planId) {
      const plan = await this.planModel.findOne({ planType, isActive: true });
      planId = plan?._id as Types.ObjectId | undefined;
    }

    payment.status = PaymentVerificationStatus.VERIFIED;
    payment.verifiedBy = new Types.ObjectId(verifiedBy);
    payment.verifiedAt = new Date();
    if (planId) payment.planId = planId;
    await payment.save();

    // Activate only after Super Admin approval (never on manual submit)
    if (planId) {
      try {
        await this.subscriptionsService.changePlan(
          payment.companyId.toString(),
          planId.toString(),
          payment._id.toString(),
          billingPeriod,
        );
      } catch (err) {
        this.logger.warn(
          `changePlan on verify failed, falling back to activateCompanyPlan: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.activateCompanyPlan(
      payment.companyId,
      planType,
      billingPeriod,
      planId,
    );

    try {
      const companyId = payment.companyId.toString();
      const adminIds = await this.companyAdminIds(companyId);
      await this.notificationsService?.notify({
        userIds: adminIds,
        companyId,
        type: NotificationType.PAYMENT_VERIFICATION,
        title: 'Payment verified successfully',
        message: `Your payment was verified. Your ${planType} subscription is now active.`,
        entityType: 'payment',
        entityId: payment._id.toString(),
        meta: { status: PaymentVerificationStatus.VERIFIED, amount: payment.amount, planType },
      });
    } catch (err) {
      this.logger.warn('Payment verify notification failed', err);
    }

    return this.responseService.success(
      'Payment approved. Subscription is now active.',
      payment,
    );
  }

  async reject(id: string, verifiedBy: string, rejectionReason?: string) {
    const payment = await this.paymentModel.findByIdAndUpdate(
      id,
      {
        status: PaymentVerificationStatus.REJECTED,
        verifiedBy,
        verifiedAt: new Date(),
        rejectionReason,
      },
      { returnDocument: 'after' },
    );
    if (!payment) throw new NotFoundException('Payment not found');

    try {
      const companyId = payment.companyId.toString();
      const adminIds = await this.companyAdminIds(companyId);
      await this.notificationsService?.notify({
        userIds: adminIds,
        companyId,
        type: NotificationType.PAYMENT_VERIFICATION,
        title: 'Payment rejected',
        message: rejectionReason
          ? `Payment rejected: ${rejectionReason}. Please submit a new payment proof.`
          : 'Payment rejected: Amount could not be verified. Please submit a new payment proof.',
        entityType: 'payment',
        entityId: payment._id.toString(),
        meta: { status: PaymentVerificationStatus.REJECTED },
      });
    } catch (err) {
      this.logger.warn('Payment reject notification failed', err);
    }

    return this.responseService.success('Payment rejected', payment);
  }

  async createRazorpayOrder(
    dto: CreateRazorpayOrderDto,
    companyId: string,
    userId: string,
  ) {
    const normalized = dto.planType.toUpperCase().trim();
    const billingPeriod = dto.billingPeriod ?? BillingPeriod.MONTHLY;
    const plan = await this.planModel.findOne({ planType: normalized, isActive: true });
    if (!plan) {
      throw new BadRequestException(`Plan "${normalized}" not found or inactive`);
    }

    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const currentPlanMeta = company.planType
      ? await this.planModel.findOne({ planType: company.planType }).lean()
      : null;
    const currentMonthly = currentPlanMeta?.monthlyPriceInr ?? 0;
    const targetMonthly = plan.monthlyPriceInr ?? 0;
    const isDowngrade = targetMonthly < currentMonthly;
    const isSameOrFree =
      targetMonthly === currentMonthly || (plan.monthlyPriceInr ?? 0) <= 0;

    const listPrice =
      billingPeriod === BillingPeriod.YEARLY ? plan.yearlyPriceInr : plan.monthlyPriceInr;

    let finalAmountInr = listPrice;
    let previewData: {
      amountToPay?: number;
      creditGenerated?: number;
      walletUsed?: number;
      usedDays?: number;
      remainingDays?: number;
      currentPrice?: number;
      newPrice?: number;
    } | null = null;
    try {
      const preview = await this.subscriptionsService.previewPlanChange(
        companyId,
        plan._id.toString(),
        billingPeriod,
      );
      previewData = preview?.data ?? null;
      if (typeof previewData?.amountToPay === 'number') {
        finalAmountInr = previewData.amountToPay;
      }
    } catch {
      finalAmountInr = listPrice;
    }

    // Downgrade / free / fully wallet-covered: apply plan change — never open Razorpay
    if (isDowngrade || isSameOrFree || finalAmountInr < 1 || listPrice <= 0) {
      const created = await this.paymentModel.create({
        companyId,
        submittedBy: userId,
        status: PaymentVerificationStatus.VERIFIED,
        planType: normalized,
        planId: plan._id,
        billingPeriod,
        amount: 0,
        transactionId: `PLAN_${Date.now()}`,
        paymentMethod: PaymentMethodType.RAZORPAY,
        paymentGateway: isDowngrade ? 'DOWNGRADE' : 'WALLET',
        verifiedBy: userId,
        verifiedAt: new Date(),
        notes: isDowngrade
          ? 'Plan downgrade confirmed (no Razorpay payment)'
          : listPrice <= 0
            ? 'Free plan change (no payment required)'
            : 'Paid fully via wallet / proration credits (no Razorpay charge)',
      });

      try {
        await this.subscriptionsService.changePlan(
          companyId,
          plan._id.toString(),
          created._id.toString(),
          billingPeriod,
        );
      } catch (err) {
        this.logger.warn(
          `changePlan during non-Razorpay switch failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      await this.activateCompanyPlan(
        companyId,
        normalized,
        billingPeriod,
        plan._id as Types.ObjectId,
      );

      return this.responseService.success(
        isDowngrade
          ? 'Plan downgraded successfully'
          : listPrice <= 0
            ? 'Plan changed successfully (free plan)'
            : 'Plan changed using wallet balance',
        {
          orderId: 'WALLET_PAID',
          amount: 0,
          currency: 'INR',
          skippedRazorpay: true,
          changeKind: isDowngrade ? 'downgrade' : 'upgrade',
          preview: previewData,
        },
      );
    }

    // Upgrade with amount due — Razorpay checkout
    this.assertRazorpayConfigured();

    const options = {
      amount: Math.round(finalAmountInr * 100),
      currency: 'INR',
      receipt: `rcpt_${companyId.slice(-6)}_${Date.now()}`.slice(0, 40),
      notes: {
        companyId,
        planType: normalized,
        billingPeriod,
        userId,
      },
    };

    try {
      const order = await this.razorpayInstance.orders.create(options);
      return this.responseService.success('Razorpay order created', {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        planType: normalized,
        billingPeriod,
        changeKind: 'upgrade',
        preview: previewData,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create Razorpay order';
      throw new BadRequestException(message);
    }
  }

  async verifyRazorpayPayment(
    dto: VerifyRazorpayPaymentDto,
    companyId: string,
    userId: string,
  ) {
    this.assertRazorpayConfigured();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planType,
      billingPeriod,
    } = dto;

    // Idempotent: same Razorpay payment id must not create duplicate activations
    const existing = await this.paymentModel.findOne({
      transactionId: razorpay_payment_id,
      paymentGateway: 'RAZORPAY',
    });
    if (existing) {
      if (existing.status === PaymentVerificationStatus.VERIFIED) {
        return this.responseService.success(
          'Payment already verified. Subscription is active.',
          existing,
        );
      }
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Do NOT activate subscription on failed signature
      throw new BadRequestException(
        'Invalid Razorpay signature. Payment was not verified and subscription was not activated.',
      );
    }

    const normalized = planType.toUpperCase().trim();
    const period = billingPeriod ?? BillingPeriod.MONTHLY;
    const plan = await this.planModel.findOne({ planType: normalized, isActive: true });
    const amountInr = plan
      ? period === BillingPeriod.YEARLY
        ? plan.yearlyPriceInr
        : plan.monthlyPriceInr
      : 0;

    const created = await this.paymentModel.create({
      companyId,
      submittedBy: userId,
      status: PaymentVerificationStatus.VERIFIED,
      planType: normalized,
      planId: plan?._id,
      billingPeriod: period,
      amount: amountInr || 0,
      transactionId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      paymentMethod: PaymentMethodType.RAZORPAY,
      paymentGateway: 'RAZORPAY',
      verifiedBy: userId,
      verifiedAt: new Date(),
      notes: 'Paid via Razorpay — auto-verified',
    });

    if (plan) {
      try {
        await this.subscriptionsService.changePlan(
          companyId,
          plan._id.toString(),
          created._id.toString(),
          period,
        );
      } catch {
        // Fall through to activateCompanyPlan for companies without prior subscription row
      }
      await this.activateCompanyPlan(
        companyId,
        normalized,
        period,
        plan._id as Types.ObjectId,
      );
    }

    return this.responseService.success(
      'Payment successful. Subscription activated.',
      created,
    );
  }
}
