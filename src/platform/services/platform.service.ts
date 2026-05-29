import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEFAULT_PLAN_LIMITS } from '../../common/constants/plan-limits.constant';
import { LicenseKeyStatus, SubscriptionPlanType } from '../../common/enums';
import { License, LicenseDocument } from '../../licenses/schemas/license.schema';
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

@Injectable()
export class PlatformService implements OnModuleInit {
  constructor(
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(PlatformSettings.name)
    private readonly settingsModel: Model<PlatformSettingsDocument>,
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
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

  private async seedPlans() {
    for (const planType of Object.values(SubscriptionPlanType)) {
      const limits = DEFAULT_PLAN_LIMITS[planType];
      await this.planModel.findOneAndUpdate(
        { planType },
        {
          planType,
          vehicleLimit: limits.vehicleLimit,
          maxAdmins: limits.maxAdmins,
          maxOwners: limits.maxOwners,
          maxDrivers: limits.maxDrivers,
          monthlyPriceInr: limits.monthlyPriceInr,
          yearlyPriceInr: limits.yearlyPriceInr,
          isActive: true,
        },
        { upsert: true },
      );
    }
  }

  async getPlans() {
    const plans = await this.planModel.find({ isActive: true }).sort({ monthlyPriceInr: 1 });
    return this.responseService.success('Subscription plans fetched', plans);
  }

  async updatePlanPricing(planType: SubscriptionPlanType, dto: UpdatePlanPricingDto) {
    const plan = await this.planModel.findOneAndUpdate(
      { planType },
      { ...dto },
      { new: true },
    );
    return this.responseService.success('Plan pricing updated', plan);
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
    const [plans, settings, totalLicenses, activeCompanies, expiringSoon] =
      await Promise.all([
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
      ]);

    return this.responseService.success('Platform dashboard', {
      plans,
      paymentSettings: settings,
      totalLicenses,
      activeCompanies,
      expiringSoon,
    });
  }
}
