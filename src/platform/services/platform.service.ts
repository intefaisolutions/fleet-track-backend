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
  UserRole,
  UserStatus,
} from '../../common/enums';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { License, LicenseDocument } from '../../licenses/schemas/license.schema';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { PasswordService } from '../../auth/services/password.service';
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
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
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
      { returnDocument: 'after' },
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
      { returnDocument: 'after', upsert: true },
    );
    return this.responseService.success('Payment settings updated', settings);
  }

  async getSuperAdminDashboard() {
    const data = await this.buildSuperAdminDashboardData();
    return this.responseService.success('Super Admin dashboard', data);
  }

  async getRevenueOverview(month?: number, year?: number) {
    const now = new Date();
    const selectedMonth = month ?? now.getMonth() + 1;
    const selectedYear = year ?? now.getFullYear();

    if (selectedMonth < 1 || selectedMonth > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }

    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevMonthYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prevMonthStart = new Date(prevMonthYear, prevMonth - 1, 1);
    const prevMonthEnd = new Date(prevMonthYear, prevMonth, 0, 23, 59, 59, 999);

    const prevYearStart = new Date(selectedYear - 1, 0, 1);
    const prevYearEnd = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      monthlyRevenueAgg,
      prevMonthlyRevenueAgg,
      yearlyRevenueAgg,
      prevYearlyRevenueAgg,
      pendingAgg,
      overduePendingCount,
      monthlyTrend,
      previousYearTrend,
      revenueByCompanyAgg,
      revenueByPlanAgg,
      paidCompaniesInMonthAgg,
      pendingCompaniesInMonthAgg,
      planDistribution,
    ] = await Promise.all([
      this.sumVerifiedPayments(monthStart, monthEnd),
      this.sumVerifiedPayments(prevMonthStart, prevMonthEnd),
      this.sumVerifiedPayments(yearStart, yearEnd),
      this.sumVerifiedPayments(prevYearStart, prevYearEnd),
      this.paymentModel.aggregate([
        { $match: { status: PaymentVerificationStatus.PENDING } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.paymentModel.countDocuments({
        status: PaymentVerificationStatus.PENDING,
        createdAt: { $lte: thirtyDaysAgo },
      }),
      this.buildYearMonthlyRevenue(selectedYear),
      this.buildYearMonthlyRevenue(selectedYear - 1),
      this.paymentModel.aggregate([
        {
          $match: {
            verifiedAt: { $gte: monthStart, $lte: monthEnd },
            status: PaymentVerificationStatus.VERIFIED,
          },
        },
        {
          $group: {
            _id: '$companyId',
            amount: { $sum: '$amount' },
            planType: { $first: '$planType' },
          },
        },
        { $sort: { amount: -1 } },
        { $limit: 20 },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            verifiedAt: { $gte: monthStart, $lte: monthEnd },
            status: PaymentVerificationStatus.VERIFIED,
          },
        },
        {
          $group: {
            _id: '$planType',
            amount: { $sum: '$amount' },
            companyCount: { $addToSet: '$companyId' },
          },
        },
        {
          $project: {
            planType: '$_id',
            amount: 1,
            companyCount: { $size: '$companyCount' },
          },
        },
        { $sort: { amount: -1 } },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            verifiedAt: { $gte: monthStart, $lte: monthEnd },
            status: PaymentVerificationStatus.VERIFIED,
          },
        },
        { $group: { _id: '$companyId' } },
        { $count: 'total' },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            status: PaymentVerificationStatus.PENDING,
            createdAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: '$companyId' } },
        { $count: 'total' },
      ]),
      this.subscriptionModel.aggregate([
        { $match: { status: SubscriptionStatus.ACTIVE } },
        { $group: { _id: '$planType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const monthlyRevenue = monthlyRevenueAgg;
    const prevMonthlyRevenue = prevMonthlyRevenueAgg;
    const yearlyRevenue = yearlyRevenueAgg;
    const prevYearlyRevenue = prevYearlyRevenueAgg;
    const pendingTotal = pendingAgg[0]?.total ?? 0;
    const pendingCount = pendingAgg[0]?.count ?? 0;

    const monthlyTrendPercent =
      prevMonthlyRevenue > 0
        ? Math.round(((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 1000) / 10
        : monthlyRevenue > 0
          ? 100
          : 0;
    const yearlyTrendPercent =
      prevYearlyRevenue > 0
        ? Math.round(((yearlyRevenue - prevYearlyRevenue) / prevYearlyRevenue) * 1000) / 10
        : yearlyRevenue > 0
          ? 100
          : 0;

    const companyIds = revenueByCompanyAgg.map((r) => r._id).filter(Boolean);
    const companies = await this.companyModel
      .find({ _id: { $in: companyIds } })
      .lean();
    const companyMap = new Map(companies.map((c) => [String(c._id), c]));

    const pendingInMonth = await this.paymentModel
      .find({
        status: PaymentVerificationStatus.PENDING,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      })
      .populate('companyId', 'name planType')
      .lean();

    const revenueByCompanyMap = new Map<
      string,
      { name: string; plan: string; amount: number; status: string }
    >();

    for (const row of revenueByCompanyAgg) {
      const company = companyMap.get(String(row._id));
      revenueByCompanyMap.set(String(row._id), {
        name: company?.name ?? 'Unknown Company',
        plan: this.formatPlanLabel(row.planType ?? company?.planType ?? 'FREE'),
        amount: row.amount as number,
        status: 'PAID',
      });
    }

    for (const p of pendingInMonth) {
      const company = p.companyId as { _id?: unknown; name?: string; planType?: string } | undefined;
      const id = company?._id ? String(company._id) : String(p.companyId);
      if (revenueByCompanyMap.has(id)) continue;
      revenueByCompanyMap.set(id, {
        name: company?.name ?? 'Unknown Company',
        plan: this.formatPlanLabel(p.planType ?? company?.planType ?? 'FREE'),
        amount: p.amount,
        status: 'PENDING',
      });
    }

    const revenueByCompany = Array.from(revenueByCompanyMap.values()).sort(
      (a, b) => b.amount - a.amount,
    );

    const planDist = planDistribution.map((p) => ({
      planType: String(p._id),
      count: p.count as number,
    }));
    const totalSubscriptions = planDist.reduce((sum, p) => sum + p.count, 0);

    const revenueByPlan = revenueByPlanAgg.map((row) => ({
      planType: this.formatPlanLabel(String(row.planType ?? 'FREE')),
      amount: row.amount as number,
      companyCount: row.companyCount as number,
    }));

    const paidCompaniesThisMonth = paidCompaniesInMonthAgg[0]?.total ?? 0;
    const pendingCompaniesThisMonth = pendingCompaniesInMonthAgg[0]?.total ?? 0;

    return this.responseService.success('Revenue overview fetched', {
      selectedMonth,
      selectedYear,
      monthlyRevenue,
      yearlyRevenue,
      pendingPayments: pendingTotal,
      pendingCount,
      overduePendingCount,
      monthlyTrendPercent,
      yearlyTrendPercent,
      monthlyTrend,
      previousYearTrend,
      revenueByCompany,
      revenueByPlan,
      paymentStatusReport: {
        paidCount: paidCompaniesThisMonth,
        pendingCount: pendingCompaniesThisMonth,
        month: selectedMonth,
        year: selectedYear,
      },
      planDistribution: planDist,
      totalSubscriptions,
    });
  }

  private formatPlanLabel(planType: string) {
    return planType
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  private async sumVerifiedPayments(start: Date, end: Date) {
    const agg = await this.paymentModel.aggregate([
      {
        $match: {
          status: PaymentVerificationStatus.VERIFIED,
          verifiedAt: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return agg[0]?.total ?? 0;
  }

  private async buildYearMonthlyRevenue(year: number) {
    const result: { label: string; amount: number; month: number; year: number }[] = [];

    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const amount = await this.sumVerifiedPayments(start, end);
      result.push({ label, amount, month: m + 1, year });
    }

    return result;
  }

  /** @deprecated Use GET /platform/dashboard — kept for backward compatibility */
  async getOwnerDashboard() {
    const data = await this.buildSuperAdminDashboardData();
    return this.responseService.success('Platform dashboard', {
      revenueThisMonth: data.stats.revenueThisMonth,
      revenueTarget: data.stats.revenueTarget,
      revenueGoalPercent: data.stats.revenueGoalPercent,
      activeCompanies: data.stats.activeCompanies,
      totalLicenses: data.stats.totalLicensesCreated,
      activeLicenses: data.stats.activeLicenses,
      expiringSoon: data.stats.expiringSoon,
      monthlyRevenue: data.revenueChart,
      topCompanies: data.topCompanies,
      recentPayments: data.recentPayments,
    });
  }

  private async buildSuperAdminDashboardData() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const activeSubscriptionCompanyIds = await this.subscriptionModel.distinct('companyId', {
      status: SubscriptionStatus.ACTIVE,
    });

    const [
      totalLicensesCreated,
      activeLicenses,
      expiringSoon,
      activeCompanies,
      revenueThisMonthAgg,
      recentPaymentsRaw,
      revenueChart,
      topByVehicles,
    ] = await Promise.all([
      this.licenseModel.countDocuments(),
      this.licenseModel.countDocuments({ status: LicenseKeyStatus.ACTIVE }),
      this.licenseModel.countDocuments({
        validUntil: { $gte: now, $lte: in30Days },
        status: { $in: [LicenseKeyStatus.ACTIVE, LicenseKeyStatus.UNUSED] },
      }),
      this.companyModel.countDocuments({
        _id: { $in: activeSubscriptionCompanyIds },
        status: CompanyStatus.ACTIVE,
      }),
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
        .populate('companyId', 'name email planType')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      this.buildMonthlyRevenueTrend(6),
      this.vehicleModel.aggregate([
        { $group: { _id: '$companyId', vehicleCount: { $sum: 1 } } },
        { $sort: { vehicleCount: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const revenueThisMonth = revenueThisMonthAgg[0]?.total ?? 0;
    const revenueTarget = 170000;
    const revenueGoalPercent =
      revenueTarget > 0 ? Math.min(100, Math.round((revenueThisMonth / revenueTarget) * 100)) : 0;

    const topCompanyIds = topByVehicles.map((r) => r._id).filter(Boolean);
    const companyDocs = await this.companyModel
      .find({ _id: { $in: topCompanyIds } })
      .lean();
    const companyMap = new Map(companyDocs.map((c) => [String(c._id), c]));

    const topCompanies = await Promise.all(
      topByVehicles.map(async (row) => {
        const company = companyMap.get(String(row._id));
        const paymentSum = await this.paymentModel.aggregate([
          {
            $match: {
              companyId: row._id,
              status: PaymentVerificationStatus.VERIFIED,
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalPaidInr = paymentSum[0]?.total ?? 0;
        return {
          id: String(row._id),
          name: company?.name ?? 'Unknown Company',
          email: company?.email ?? '',
          planType: company?.planType ?? 'FREE',
          vehicleCount: row.vehicleCount as number,
          totalPaidInr,
          mrrInr: totalPaidInr,
        };
      }),
    );

    const recentPayments = recentPaymentsRaw.map((p) => {
      const company = p.companyId as
        | { _id?: unknown; name?: string; email?: string }
        | undefined;
      return {
        _id: String(p._id),
        transactionId: p.transactionId,
        amount: p.amount,
        status: p.status,
        planType: p.planType,
        createdAt: (p as { createdAt?: Date }).createdAt?.toISOString(),
        verifiedAt: p.verifiedAt?.toISOString(),
        companyId: company?._id ? String(company._id) : String(p.companyId),
        companyName: company?.name ?? 'Client Company',
      };
    });

    return {
      stats: {
        revenueThisMonth,
        revenueTarget,
        revenueGoalPercent,
        activeCompanies,
        totalLicensesCreated,
        activeLicenses,
        expiringSoon,
      },
      revenueChart,
      recentPayments,
      topCompanies,
    };
  }

  private async buildMonthlyRevenueTrend(months: number) {
    const result: { label: string; amount: number; month: number; year: number }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const agg = await this.paymentModel.aggregate([
        {
          $match: {
            status: PaymentVerificationStatus.VERIFIED,
            verifiedAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      result.push({
        label,
        amount: agg[0]?.total ?? 0,
        month: start.getMonth() + 1,
        year: start.getFullYear(),
      });
    }

    return result;
  }

  async getSupportAdmins() {
    const admins = await this.userModel
      .find({ role: UserRole.SUPPORT_ADMIN, status: { $ne: UserStatus.INACTIVE } })
      .select('fullName email phone permissions status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return this.responseService.success('Support admins fetched', admins.map((a) => ({
      name: a.fullName,
      email: a.email,
      phone: a.phone,
      permissions: a.permissions ?? [],
      status: a.status,
      createdAt: (a as { createdAt?: Date }).createdAt,
    })));
  }

  async addSupportAdmin(dto: {
    name: string;
    email: string;
    phone: string;
    password: string;
    permissions: string[];
  }) {
    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();
    const normalizedPhone = normalizePhone(phone);
    const permissions = dto.permissions.map((p) => p.trim()).filter(Boolean);
    if (permissions.length === 0) {
      throw new BadRequestException('At least one permission is required');
    }

    const existingUsers = await this.userModel.find({
      $or: [{ email }, { phone }],
    });
    for (const u of existingUsers) {
      if (normalizeEmail(u.email) === email) {
        throw new ConflictException('Email already exists');
      }
      if (normalizePhone(u.phone) === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const password = await this.passwordService.hash(dto.password);
    await this.userModel.create({
      fullName: dto.name.trim(),
      email,
      phone,
      password,
      role: UserRole.SUPPORT_ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      permissions,
    });

    return this.getSupportAdmins();
  }

  async removeSupportAdmin(email: string) {
    const normalized = email.toLowerCase().trim();
    const removed = await this.userModel.findOneAndUpdate(
      { email: normalized, role: UserRole.SUPPORT_ADMIN },
      { status: UserStatus.INACTIVE },
      { returnDocument: 'after' },
    );
    if (!removed) {
      throw new BadRequestException('Support admin not found');
    }
    return this.responseService.success('Support admin removed');
  }

  async updateSupportAdminPermissions(email: string, permissions: string[]) {
    const normalized = email.toLowerCase().trim();
    const cleaned = permissions.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      throw new BadRequestException('At least one permission is required');
    }

    const updated = await this.userModel.findOneAndUpdate(
      { email: normalized, role: UserRole.SUPPORT_ADMIN, status: { $ne: UserStatus.INACTIVE } },
      { $set: { permissions: cleaned } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      throw new BadRequestException('Support admin not found');
    }

    return this.responseService.success('Support admin permissions updated', {
      email: updated.email,
      permissions: updated.permissions ?? [],
    });
  }
}
