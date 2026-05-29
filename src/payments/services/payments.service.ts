import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BillingPeriod,
  PaymentVerificationStatus,
  SubscriptionStatus,
} from '../../common/enums';
import { DEFAULT_PLAN_LIMITS } from '../../common/constants/plan-limits.constant';
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
    private readonly responseService: ResponseService,
  ) {}

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

    const limits = DEFAULT_PLAN_LIMITS[payment.planType];
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
      { new: true },
    );
    if (!payment) throw new NotFoundException('Payment not found');
    return this.responseService.success('Payment rejected', payment);
  }
}
