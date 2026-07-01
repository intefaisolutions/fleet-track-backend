import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
const Razorpay = require('razorpay');
import {
  BillingPeriod,
  PaymentVerificationStatus,
  SubscriptionStatus,
} from '../../common/enums';
import { DEFAULT_PLAN_LIMITS } from '../../common/constants/plan-limits.constant';
import { SubscriptionPlanType } from '../../common/enums';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../../platform/schemas/subscription-plan.schema';
import { ResponseService } from '../../common/responses/response.service';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Subscription, SubscriptionDocument } from '../../subscriptions/schemas/subscription.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { SubmitPaymentDto } from '../dto/submit-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    private readonly responseService: ResponseService,
  ) {}

  private get razorpayInstance() {
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
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
      };
    }

    const fallback =
      DEFAULT_PLAN_LIMITS[normalized as SubscriptionPlanType];
    if (fallback) return fallback;

    throw new BadRequestException(`Plan "${normalized}" not found`);
  }

  async submit(dto: SubmitPaymentDto, companyId: string, userId: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const created = await this.paymentModel.create({
      ...dto,
      companyId,
      submittedBy: userId,
      status: PaymentVerificationStatus.PENDING,
    });

    return this.responseService.created(
      'Payment submitted. Awaiting Company Owner verification.',
      created,
    );
  }

  async findAll(status?: PaymentVerificationStatus, companyId?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (companyId) filter.companyId = companyId;

    const items = await this.paymentModel
      .find(filter)
      .populate('companyId', 'name email planType')
      .sort({ createdAt: -1 });

    return this.responseService.success('Payments fetched successfully', items);
  }

  async verify(id: string, verifiedBy: string) {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentVerificationStatus.PENDING) {
      throw new BadRequestException('Payment is not pending verification');
    }

    payment.status = PaymentVerificationStatus.VERIFIED;
    payment.verifiedBy = new Types.ObjectId(verifiedBy);
    payment.verifiedAt = new Date();
    await payment.save();

    const limits = await this.resolvePlanLimits(payment.planType || '');
    await this.companyModel.findByIdAndUpdate(payment.companyId, {
      planType: payment.planType,
      vehicleLimit: limits.vehicleLimit,
      maxAdmins: limits.maxAdmins,
      maxOwners: limits.maxOwners,
      maxDrivers: limits.maxDrivers,
    });

    const periodEnd = new Date();
    if (payment.billingPeriod === BillingPeriod.YEARLY) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.subscriptionModel.findOneAndUpdate(
      { companyId: payment.companyId },
      {
        planType: payment.planType,
        status: SubscriptionStatus.ACTIVE,
        vehicleLimit: limits.vehicleLimit,
        billingPeriod: payment.billingPeriod,
        currentPeriodEnd: periodEnd,
      },
      { upsert: true },
    );

    return this.responseService.success('Payment verified and plan upgraded', payment);
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
    return this.responseService.success('Payment rejected', payment);
  }

  async createRazorpayOrder(planType: string, billingPeriod: BillingPeriod, companyId: string) {
    const normalized = planType.toUpperCase().trim();
    const plan = await this.planModel.findOne({ planType: normalized, isActive: true });
    if (!plan) throw new BadRequestException(`Plan "${normalized}" not found or inactive`);

    const amountInr = billingPeriod === BillingPeriod.YEARLY ? plan.yearlyPriceInr : plan.monthlyPriceInr;
    if (!amountInr || amountInr <= 0) {
      throw new BadRequestException('Plan is free or price is not set');
    }

    const options = {
      amount: amountInr * 100, // Razorpay amount is in paise
      currency: 'INR',
      receipt: `rcpt_${companyId.substring(companyId.length - 6)}_${Date.now()}`,
    };

    try {
      const order = await this.razorpayInstance.orders.create(options);
      return this.responseService.success('Razorpay order created', {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (error) {
      console.error('Razorpay Error:', error);
      throw error;
    }
  }

  async verifyRazorpayPayment(dto: any, companyId: string, userId: string) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType, billingPeriod } = dto;
    
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new BadRequestException('Invalid signature');
    }

    // Determine amount to save in payment record
    const normalized = planType.toUpperCase().trim();
    const plan = await this.planModel.findOne({ planType: normalized, isActive: true });
    const amountInr = plan ? (billingPeriod === BillingPeriod.YEARLY ? plan.yearlyPriceInr : plan.monthlyPriceInr) : 0;

    // Payment is valid, let's create a payment record
    const created = await this.paymentModel.create({
      companyId,
      submittedBy: userId,
      status: PaymentVerificationStatus.VERIFIED, // auto verify
      planType: normalized,
      billingPeriod,
      amount: amountInr || 0,
      transactionId: razorpay_payment_id,
      verifiedBy: userId,
      verifiedAt: new Date(),
      notes: 'Paid via Razorpay',
    });

    const limits = await this.resolvePlanLimits(normalized);
    await this.companyModel.findByIdAndUpdate(companyId, {
      planType: normalized,
      vehicleLimit: limits.vehicleLimit,
      maxAdmins: limits.maxAdmins,
      maxOwners: limits.maxOwners,
      maxDrivers: limits.maxDrivers,
    });

    const periodEnd = new Date();
    if (billingPeriod === BillingPeriod.YEARLY) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.subscriptionModel.findOneAndUpdate(
      { companyId },
      {
        planType: normalized,
        status: SubscriptionStatus.ACTIVE,
        vehicleLimit: limits.vehicleLimit,
        billingPeriod: billingPeriod,
        currentPeriodEnd: periodEnd,
      },
      { upsert: true },
    );

    return this.responseService.success('Payment successful and plan upgraded', created);
  }
}
