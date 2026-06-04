import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DEFAULT_PLAN_LIMITS } from '../../common/constants/plan-limits.constant';
import { LicenseKeyStatus } from '../../common/enums';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../../platform/schemas/subscription-plan.schema';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { generateLicenseKey, normalizeLicenseKey } from '../../common/utils/license-key.util';
import { ResponseService } from '../../common/responses/response.service';
import { MailService } from '../../mail/mail.service';
import { License, LicenseDocument } from '../schemas/license.schema';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';

/** Default when LICENSE_GRACE_PERIOD_DAYS is unset */
export const LICENSE_GRACE_PERIOD_DAYS = 7;

@Injectable()
export class LicensesService {
  constructor(
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly responseService: ResponseService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  private getGracePeriodDays(): number {
    const configured = this.configService.get<number>('app.licenseGracePeriodDays');
    if (typeof configured === 'number' && configured >= 0 && Number.isFinite(configured)) {
      return configured;
    }
    return LICENSE_GRACE_PERIOD_DAYS;
  }

  /** Last moment login is allowed after validUntil (validUntil + N days, end of that day UTC). */
  getGracePeriodEnd(validUntil: Date): Date {
    const end = new Date(validUntil);
    end.setUTCDate(end.getUTCDate() + this.getGracePeriodDays());
    end.setUTCHours(23, 59, 59, 999);
    return end;
  }

  isWithinGracePeriod(validUntil: Date): boolean {
    const now = new Date();
    if (now <= validUntil) {
      return false;
    }
    return now <= this.getGracePeriodEnd(validUntil);
  }

  isPastGracePeriod(validUntil: Date): boolean {
    const now = new Date();
    return now > validUntil && now > this.getGracePeriodEnd(validUntil);
  }

  private formatPlanLabel(planType: string) {
    return planType
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  private async refreshExpiredStatus(license: LicenseDocument): Promise<LicenseDocument> {
    if (
      license.status === LicenseKeyStatus.REVOKED ||
      license.status === LicenseKeyStatus.CANCELLED ||
      license.status === LicenseKeyStatus.UNUSED
    ) {
      return license;
    }

    if (
      license.status === LicenseKeyStatus.ACTIVE &&
      this.isPastGracePeriod(license.validUntil)
    ) {
      const updated = await this.licenseModel.findByIdAndUpdate(
        license._id,
        { status: LicenseKeyStatus.EXPIRED },
        { new: true },
      );
      return updated ?? license;
    }

    return license;
  }

  async validateKeyPublic(licenseKey: string) {
    const result = await this.validateKeyPreview(licenseKey);
    return this.responseService.success('License validation', result);
  }

  async validateKeyPreview(licenseKey: string) {
    const license = await this.findByKey(licenseKey);
    if (!license) {
      return { valid: false, message: 'Invalid license key' };
    }

    const refreshed = await this.refreshExpiredStatus(license);

    if (refreshed.status === LicenseKeyStatus.CANCELLED) {
      return { valid: false, message: 'This license has been cancelled' };
    }
    if (refreshed.status === LicenseKeyStatus.REVOKED) {
      return { valid: false, message: 'This license has been revoked' };
    }
    if (refreshed.status !== LicenseKeyStatus.UNUSED) {
      return { valid: false, message: 'This license key has already been used' };
    }
    if (refreshed.validUntil < new Date()) {
      return { valid: false, message: 'This license key has expired' };
    }

    return {
      valid: true,
      plan: refreshed.planType,
      planLabel: this.formatPlanLabel(refreshed.planType),
      intendedCompanyName: refreshed.intendedCompanyName,
      contactEmail: refreshed.contactEmail,
      contactPhone: refreshed.contactPhone,
      maxAdmins: refreshed.maxAdmins,
      maxOwners: refreshed.maxOwners,
      maxDrivers: refreshed.maxDrivers,
      maxVehicles: refreshed.maxVehicles,
      validUntil: refreshed.validUntil.toISOString(),
    };
  }

  async assertCompanyLicenseAllowsAccess(companyId: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new ForbiddenException('Company not found');
    }

    if (!company.licenseId) {
      return;
    }

    const license = await this.licenseModel.findById(company.licenseId);
    if (!license) {
      throw new ForbiddenException('Company license not found');
    }

    const refreshed = await this.refreshExpiredStatus(license);

    if (refreshed.status === LicenseKeyStatus.REVOKED) {
      throw new ForbiddenException(
        'Your company license has been revoked. Contact FleetTrack support.',
      );
    }
    if (refreshed.status === LicenseKeyStatus.CANCELLED) {
      throw new ForbiddenException(
        'Your company license has been cancelled. Contact FleetTrack support.',
      );
    }

    if (this.isPastGracePeriod(refreshed.validUntil)) {
      throw new ForbiddenException(
        `Your company license has expired. Login is blocked after the ${this.getGracePeriodDays()}-day grace period. Please renew to continue.`,
      );
    }
  }

  /** Shown on login when validUntil passed but grace still allows access */
  async getGracePeriodNoticeForCompany(companyId: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company?.licenseId) {
      return null;
    }
    const license = await this.licenseModel.findById(company.licenseId);
    if (!license) {
      return null;
    }
    const refreshed = await this.refreshExpiredStatus(license);
    if (
      refreshed.status === LicenseKeyStatus.REVOKED ||
      refreshed.status === LicenseKeyStatus.CANCELLED
    ) {
      return null;
    }
    if (!this.isWithinGracePeriod(refreshed.validUntil)) {
      return null;
    }
    const graceEndsAt = this.getGracePeriodEnd(refreshed.validUntil);
    return {
      inGracePeriod: true,
      validUntil: refreshed.validUntil.toISOString(),
      graceEndsAt: graceEndsAt.toISOString(),
      graceDays: this.getGracePeriodDays(),
      message: `Your license expired on ${refreshed.validUntil.toLocaleDateString('en-IN')}. You can log in until ${graceEndsAt.toLocaleDateString('en-IN')} (${this.getGracePeriodDays()}-day grace period). Please renew.`,
    };
  }

  private async assertUniqueLicenseContact(contactEmail?: string, contactPhone?: string) {
    const activeFilter = { status: { $ne: LicenseKeyStatus.CANCELLED } };

    if (contactEmail) {
      const email = normalizeEmail(contactEmail);
      const existingForEmail = await this.licenseModel.findOne({
        ...activeFilter,
        contactEmail: email,
      });
      if (existingForEmail) {
        throw new ConflictException(
          'A license already exists for this contact email. Use a different email or cancel the existing license first.',
        );
      }
    }

    if (contactPhone) {
      const phoneDigits = normalizePhone(contactPhone);
      const withPhone = await this.licenseModel.find({
        ...activeFilter,
        contactPhone: { $exists: true, $nin: [null, ''] },
      });
      const duplicatePhone = withPhone.some(
        (license) => license.contactPhone && normalizePhone(license.contactPhone) === phoneDigits,
      );
      if (duplicatePhone) {
        throw new ConflictException(
          'A license already exists for this contact phone number. Use a different number or cancel the existing license first.',
        );
      }
    }
  }

  async create(dto: CreateLicenseDto) {
    const planType = dto.planType.toUpperCase().trim();
    const plan = await this.planModel.findOne({ planType, isActive: true });
    if (!plan) {
      throw new BadRequestException(
        `Plan "${planType}" not found. Create it under Subscription Plans first.`,
      );
    }

    const normalizedEmail = dto.contactEmail ? normalizeEmail(dto.contactEmail) : undefined;
    const normalizedPhone = dto.contactPhone?.trim();
    await this.assertUniqueLicenseContact(normalizedEmail, normalizedPhone);

    const licenseKey = generateLicenseKey();

    const created = await this.licenseModel.create({
      licenseKey,
      intendedCompanyName: dto.intendedCompanyName,
      contactEmail: normalizedEmail,
      contactPhone: normalizedPhone,
      planType,
      maxAdmins: dto.maxAdmins ?? plan.maxAdmins,
      maxOwners: dto.maxOwners ?? plan.maxOwners,
      maxDrivers: dto.maxDrivers ?? plan.maxDrivers,
      maxVehicles: dto.maxVehicles ?? plan.vehicleLimit,
      validUntil: dto.validUntil,
      status: LicenseKeyStatus.UNUSED,
      notes: dto.notes,
    });

    let emailed = false;
    if (created.contactEmail) {
      try {
        emailed = await this.mailService.sendLicenseKeyEmail(
          created.contactEmail,
          created.licenseKey,
          {
            companyName: created.intendedCompanyName,
            contactPhone: created.contactPhone,
            planType: this.formatPlanLabel(created.planType),
            validUntil: created.validUntil.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            maxAdmins: created.maxAdmins,
            maxOwners: created.maxOwners,
            maxDrivers: created.maxDrivers,
            maxVehicles: created.maxVehicles,
          },
        );
      } catch {
        emailed = false;
      }
    }

    return this.responseService.created('License key generated successfully', {
      ...created.toObject(),
      emailed,
    });
  }

  async sendLicenseEmail(id: string) {
    const license = await this.licenseModel.findById(id);
    if (!license) {
      throw new NotFoundException('License not found');
    }
    if (!license.contactEmail) {
      throw new BadRequestException('No contact email on this license');
    }

    const emailed = await this.mailService.sendLicenseKeyEmail(
      license.contactEmail,
      license.licenseKey,
      {
        companyName: license.intendedCompanyName,
        contactPhone: license.contactPhone,
        planType: this.formatPlanLabel(license.planType),
        validUntil: license.validUntil.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        maxAdmins: license.maxAdmins,
        maxOwners: license.maxOwners,
        maxDrivers: license.maxDrivers,
        maxVehicles: license.maxVehicles,
      },
    );

    if (!emailed) {
      throw new BadRequestException(
        'Email could not be sent. Check SMTP settings in .env',
      );
    }

    return this.responseService.success('License key emailed successfully', { emailed: true });
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
    const preview = await this.validateKeyPreview(licenseKey);
    if (!preview.valid) {
      throw new BadRequestException(preview.message ?? 'Invalid license key');
    }
    const license = await this.findByKey(licenseKey);
    if (!license) {
      throw new BadRequestException('Invalid license key');
    }
    return license;
  }

  async markUsed(licenseId: string, companyId: string) {
    return this.licenseModel.findByIdAndUpdate(
      licenseId,
      {
        companyId: new Types.ObjectId(companyId),
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
    const existing = await this.licenseModel.findById(id);
    if (!existing) throw new NotFoundException('License not found');

    const nextStatus =
      existing.status === LicenseKeyStatus.UNUSED
        ? LicenseKeyStatus.UNUSED
        : LicenseKeyStatus.ACTIVE;

    const item = await this.licenseModel.findByIdAndUpdate(
      id,
      { validUntil, status: nextStatus },
      { new: true },
    );

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
