import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEFAULT_PLAN_LIMITS } from '../../common/constants/plan-limits.constant';
import { LicenseKeyStatus } from '../../common/enums';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../../platform/schemas/subscription-plan.schema';
import { generateLicenseKey, normalizeLicenseKey } from '../../common/utils/license-key.util';
import { ResponseService } from '../../common/responses/response.service';
import { License, LicenseDocument } from '../schemas/license.schema';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';

@Injectable()
export class LicensesService {
  constructor(
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: CreateLicenseDto) {
    const planType = dto.planType.toUpperCase().trim();
    const plan = await this.planModel.findOne({ planType, isActive: true });
    if (!plan) {
      throw new BadRequestException(
        `Plan "${planType}" not found. Create it under Subscription Plans first.`,
      );
    }

    const licenseKey = generateLicenseKey();

    const created = await this.licenseModel.create({
      licenseKey,
      intendedCompanyName: dto.intendedCompanyName,
      contactEmail: dto.contactEmail?.toLowerCase(),
      planType,
      maxAdmins: dto.maxAdmins ?? plan.maxAdmins,
      maxOwners: dto.maxOwners ?? plan.maxOwners,
      maxDrivers: dto.maxDrivers ?? plan.maxDrivers,
      maxVehicles: dto.maxVehicles ?? plan.vehicleLimit,
      validUntil: dto.validUntil,
      status: LicenseKeyStatus.UNUSED,
      notes: dto.notes,
    });

    return this.responseService.created('License key generated successfully', created);
  }

  async findAll(status?: LicenseKeyStatus) {
    const filter = status ? { status } : {};
    const items = await this.licenseModel.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Licenses fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.licenseModel.findById(id);
    if (!item) throw new NotFoundException('License not found');
    return this.responseService.success('License fetched successfully', item);
  }

  async findByKey(licenseKey: string) {
    return this.licenseModel.findOne({
      licenseKey: normalizeLicenseKey(licenseKey),
    });
  }

  async validateForRegistration(licenseKey: string) {
    const license = await this.findByKey(licenseKey);
    if (!license) {
      throw new BadRequestException('Invalid license key');
    }
    if (license.status === LicenseKeyStatus.CANCELLED) {
      throw new BadRequestException('This license has been cancelled');
    }
    if (license.status === LicenseKeyStatus.REVOKED) {
      throw new BadRequestException('This license has been revoked');
    }
    if (license.status !== LicenseKeyStatus.UNUSED) {
      throw new BadRequestException('This license key has already been used');
    }
    if (license.validUntil < new Date()) {
      throw new BadRequestException('This license key has expired');
    }
    return license;
  }

  async markUsed(licenseId: string, companyId: string) {
    return this.licenseModel.findByIdAndUpdate(
      licenseId,
      {
        companyId,
        status: LicenseKeyStatus.ACTIVE,
        usedAt: new Date(),
      },
      { new: true },
    );
  }

  async revoke(id: string) {
    const item = await this.licenseModel.findByIdAndUpdate(
      id,
      { status: LicenseKeyStatus.REVOKED, revokedAt: new Date() },
      { new: true },
    );
    if (!item) throw new NotFoundException('License not found');
    return this.responseService.success('License revoked successfully', item);
  }

  async extend(id: string, validUntil: Date) {
    const item = await this.licenseModel.findByIdAndUpdate(
      id,
      { validUntil, status: LicenseKeyStatus.ACTIVE },
      { new: true },
    );
    if (!item) throw new NotFoundException('License not found');
    return this.responseService.success('License extended successfully', item);
  }

  async cancel(id: string) {
    const item = await this.licenseModel.findByIdAndUpdate(
      id,
      { status: LicenseKeyStatus.CANCELLED },
      { new: true },
    );
    if (!item) throw new NotFoundException('License not found');
    return this.responseService.success('License cancelled successfully', item);
  }

  async update(id: string, dto: UpdateLicenseDto) {
    const item = await this.licenseModel.findByIdAndUpdate(id, dto, { new: true });
    if (!item) throw new NotFoundException('License not found');
    return this.responseService.success('License updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.licenseModel.findById(id);
    if (!item) throw new NotFoundException('License not found');
    if (item.status === LicenseKeyStatus.ACTIVE && item.companyId) {
      throw new BadRequestException('Cannot delete an active license in use');
    }
    await this.licenseModel.findByIdAndDelete(id);
    return this.responseService.success('License deleted successfully');
  }

  async getPlanDefaults(planType: string) {
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
    const fallback = DEFAULT_PLAN_LIMITS[normalized as keyof typeof DEFAULT_PLAN_LIMITS];
    if (fallback) return fallback;
    throw new BadRequestException(`Plan "${normalized}" not found`);
  }
}
