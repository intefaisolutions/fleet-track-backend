import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_PLAN_LIMITS,
  PLAN_MARKETING,
} from '../../common/constants/plan-limits.constant';
import {
  CompanyStatus,
  LicenseKeyStatus,
  PaymentVerificationStatus,
  SubscriptionPlanType,
  SubscriptionStatus,
} from '../../common/enums';
import { License, LicenseDocument } from '../../licenses/schemas/license.schema';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../../subscriptions/schemas/subscription.schema';
import { ResponseService } from '../../common/responses/response.service';
import {
  PlatformSettings,
  PlatformSettingsDocument,
} from '../schemas/platform-settings.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../schemas/subscription-plan.schema';
import { UpdatePlatformSettingsDto } from '../dto/update-platform-settings.dto';
import { UpdatePlanPricingDto } from '../dto/update-plan-pricing.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';

@Injectable()
export class PlatformService implements OnModuleInit {
  constructor(
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(PlatformSettings.name)
    private readonly settingsModel: Model<PlatformSettingsDocument>,
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async onModuleInit() {
    await this.seedPlans();
    await this.settingsModel.findOneAndUpdate(
      { key: 'PLATFORM' },
      { $setOnInsert: { key: 'PLATFORM' } },
      { upsert: true },
    );
  }

  private slugifyPlanType(displayName: string): string {
    return displayName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
  }

  private async seedPlans() {
    for (const planType of Object.values(SubscriptionPlanType)) {
      const limits = DEFAULT_PLAN_LIMITS[planType];
      const marketing = PLAN_MARKETING[planType];
      await this.planModel.findOneAndUpdate(
        { planType },
        {
          $set: {
            displayName: marketing.displayName,
            description: marketing.description,
            features: marketing.features,
            isSystem: true,
            isActive: true,
          },
          $setOnInsert: {
            planType,
            vehicleLimit: limits.vehicleLimit,
            maxAdmins: limits.maxAdmins,
            maxOwners: limits.maxOwners,
            maxDrivers: limits.maxDrivers,
            monthlyPriceInr: limits.monthlyPriceInr,
            yearlyPriceInr: limits.yearlyPriceInr,
          },
        },
        { upsert: true },
      );
    }
  }

  async createPlan(dto: CreatePlanDto) {
    const planType = this.slugifyPlanType(dto.displayName);
    if (!planType || planType.length < 2) {
      throw new BadRequestException('Plan name must include letters or numbers');
    }

    const existing = await this.planModel.findOne({ planType });
    if (existing) {
      throw new ConflictException(`Plan code "${planType}" already exists`);
    }

    const created = await this.planModel.create({
      planType,
      displayName: dto.displayName.trim(),
      description: dto.description?.trim(),
      features: (dto.features ?? []).map((f) => f.trim()).filter(Boolean),
      isSystem: false,
      isActive: true,
      vehicleLimit: dto.vehicleLimit,
      monthlyPriceInr: dto.monthlyPriceInr,
      yearlyPriceInr: dto.yearlyPriceInr,
      maxAdmins: dto.maxAdmins ?? 2,
      maxOwners: dto.maxOwners ?? 5,
      maxDrivers: dto.maxDrivers ?? 15,
    });

    return this.responseService.created('Subscription plan created successfully', created);
  }

  async getPlans() {
    const plans = await this.planModel.find({ isActive: true }).sort({ monthlyPriceInr: 1 });
    return this.responseService.success('Subscription plans fetched', plans);
  }

  async updatePlanPricing(planType: string, dto: UpdatePlanPricingDto) {
    const normalized = planType.toUpperCase().trim();
    const plan = await this.planModel.findOneAndUpdate(
      { planType: normalized },
      { ...dto },
      { new: true },
    );
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }
    return this.responseService.success('Plan pricing updated', plan);
  }

  async getPricingOverview() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [plans, settings, activeSubscriptions, pendingTransitions, canceledLast30Days] =
      await Promise.all([
        this.planModel.find({ isActive: true }).sort({ monthlyPriceInr: 1 }),
        this.settingsModel.findOne({ key: 'PLATFORM' }),
        this.subscriptionModel.countDocuments({ status: SubscriptionStatus.ACTIVE }),
        this.paymentModel.countDocuments({
          status: PaymentVerificationStatus.PENDING,
        }),
        this.subscriptionModel.countDocuments({
          status: SubscriptionStatus.CANCELLED,
          updatedAt: { $gte: thirtyDaysAgo },
        }),
      ]);

    return this.responseService.success('Pricing overview', {
      plans,
      yearlyDiscountPercent: settings?.yearlyDiscountPercent ?? 20,
      stats: {
        activeSubscriptions,
        pendingTransitions,
        canceledLast30Days,
      },
    });
  }

  async getPaymentSettings() {
    const settings = await this.settingsModel.findOne({ key: 'PLATFORM' });
    return this.responseService.success('Payment settings fetched', settings);
  }

  async updatePaymentSettings(dto: UpdatePlatformSettingsDto) {
    const settings = await this.settingsModel.findOneAndUpdate(
      { key: 'PLATFORM' },
      { ...dto, key: 'PLATFORM' },
      { new: true, upsert: true },
    );
    return this.responseService.success('Payment settings updated', settings);
  }

  async getOwnerDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      plans,
      settings,
      totalLicenses,
      activeLicenses,
      expiringSoon,
      activeCompanies,
      revenueThisMonthAgg,
      recentPayments,
      monthlyRevenue,
      topCompaniesRaw,
    ] = await Promise.all([
      this.planModel.find({ isActive: true }),
      this.settingsModel.findOne({ key: 'PLATFORM' }),
      this.licenseModel.countDocuments(),
      this.licenseModel.countDocuments({ status: LicenseKeyStatus.ACTIVE }),
      this.licenseModel.countDocuments({
        status: LicenseKeyStatus.ACTIVE,
        validUntil: {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          $gte: new Date(),
        },
      }),
      this.companyModel.countDocuments({ status: CompanyStatus.ACTIVE }),
      this.paymentModel.aggregate([
        {
          $match: {
            status: PaymentVerificationStatus.VERIFIED,
            verifiedAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.paymentModel
        .find()
        .populate('companyId', 'name')
        .sort({ createdAt: -1 })
        .limit(8),
      this.buildMonthlyRevenueTrend(6),
      this.companyModel
        .find({ status: CompanyStatus.ACTIVE })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const revenueThisMonth = revenueThisMonthAgg[0]?.total ?? 0;
    const revenueTarget = 170000;
    const revenueGoalPercent =
      revenueTarget > 0 ? Math.min(100, Math.round((revenueThisMonth / revenueTarget) * 100)) : 0;

    const topCompanies = await Promise.all(
      topCompaniesRaw.map(async (c) => {
        const [paymentSum, vehicleCount, licenseCount] = await Promise.all([
          this.paymentModel.aggregate([
            {
              $match: {
                companyId: c._id,
                status: PaymentVerificationStatus.VERIFIED,
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
          this.vehicleModel.countDocuments({ companyId: c._id }),
          this.licenseModel.countDocuments({ companyId: c._id }),
        ]);
        return {
          id: c._id,
          name: c.name,
          planType: c.planType,
          mrrInr: paymentSum[0]?.total ?? 0,
          vehicleCount,
          licenseCount: licenseCount || 1,
        };
      }),
    );

    topCompanies.sort((a, b) => b.mrrInr - a.mrrInr);

    return this.responseService.success('Platform dashboard', {
      plans,
      paymentSettings: settings,
      totalLicenses,
      activeLicenses,
      expiringSoon,
      activeCompanies,
      revenueThisMonth,
      revenueTarget,
      revenueGoalPercent,
      monthlyRevenue,
      topCompanies: topCompanies.slice(0, 4),
      recentPayments,
    });
  }

  private async buildMonthlyRevenueTrend(months: number) {
    const result: { label: string; amount: number }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString('en-IN', { month: 'short' });

      const agg = await this.paymentModel.aggregate([
        {
          $match: {
            status: PaymentVerificationStatus.VERIFIED,
            verifiedAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      result.push({ label, amount: agg[0]?.total ?? 0 });
    }

    return result;
  }

  async getSupportAdmins() {
    const settings = await this.settingsModel.findOne({ key: 'PLATFORM' });
    return this.responseService.success(
      'Support admins fetched',
      settings?.supportAdmins ?? [],
    );
  }

  async addSupportAdmin(dto: {
    name: string;
    email: string;
    permissions: string[];
  }) {
    const email = dto.email.toLowerCase().trim();
    const settings = await this.settingsModel.findOne({ key: 'PLATFORM' });
    const existing = settings?.supportAdmins ?? [];

    if (existing.some((a) => a.email.toLowerCase() === email)) {
      throw new BadRequestException('Support admin with this email already exists');
    }

    const updated = await this.settingsModel.findOneAndUpdate(
      { key: 'PLATFORM' },
      {
        $push: {
          supportAdmins: {
            name: dto.name.trim(),
            email,
            permissions: dto.permissions,
          },
        },
      },
      { new: true, upsert: true },
    );

    return this.responseService.success(
      'Support admin added',
      updated?.supportAdmins ?? [],
    );
  }

  async removeSupportAdmin(email: string) {
    const normalized = email.toLowerCase().trim();
    const updated = await this.settingsModel.findOneAndUpdate(
      { key: 'PLATFORM' },
      { $pull: { supportAdmins: { email: normalized } } },
      { new: true },
    );

    return this.responseService.success(
      'Support admin removed',
      updated?.supportAdmins ?? [],
    );
  }
}
