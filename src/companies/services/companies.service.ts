import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CompanyStatus,
  SubscriptionPlanType,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '../../common/enums';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { ResponseService } from '../../common/responses/response.service';
import { PasswordService } from '../../auth/services/password.service';
import { LicensesService } from '../../licenses/services/licenses.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../../subscriptions/schemas/subscription.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';
import { AddCompanySubAdminDto } from '../dto/company-sub-admin.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
    private readonly licensesService: LicensesService,
  ) {}

  private async assertContactUnique(
    email: string,
    phone: string,
    excludeCompanyId?: string,
  ) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const companies = await this.companyModel.find({
      ...(excludeCompanyId ? { _id: { $ne: excludeCompanyId } } : {}),
      $or: [{ email: normalizedEmail }, { phone }],
    });

    for (const c of companies) {
      if (normalizeEmail(c.email) === normalizedEmail) {
        throw new ConflictException('This email is already registered with another company');
      }
      if (normalizePhone(c.phone) === normalizedPhone) {
        throw new ConflictException('This phone number is already registered with another company');
      }
    }

    const users = await this.userModel.find({
      $or: [{ email: normalizedEmail }, { phone }],
    });

    for (const u of users) {
      if (normalizeEmail(u.email) === normalizedEmail) {
        throw new ConflictException('This email is already used by another user account');
      }
      if (normalizePhone(u.phone) === normalizedPhone) {
        throw new ConflictException('This phone number is already used by another user account');
      }
    }
  }

  async register(dto: RegisterCompanyDto) {
    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();

    await this.assertContactUnique(email, phone);

    const license = await this.licensesService.validateForRegistration(dto.licenseKey);
    const hashedPassword = await this.passwordService.hash(dto.password);

    try {
      const company = await this.companyModel.create({
        name: dto.companyName.trim(),
        email,
        phone,
        status: CompanyStatus.ACTIVE,
        planType: license.planType,
        licenseId: license._id,
        vehicleLimit: license.maxVehicles,
        maxAdmins: license.maxAdmins,
        maxOwners: license.maxOwners,
        maxDrivers: license.maxDrivers,
      });

      await this.userModel.create({
        fullName: dto.adminName.trim(),
        email,
        phone,
        password: hashedPassword,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: company._id,
        isEmailVerified: true,
      });

      await this.licensesService.markUsed(license._id.toString(), company._id.toString());

      await this.subscriptionModel.create({
        companyId: company._id,
        planType: license.planType,
        status: SubscriptionStatus.ACTIVE,
        vehicleLimit: license.maxVehicles,
        currentPeriodEnd: license.validUntil,
        licenseId: license._id,
      });

      return this.responseService.created(
        'Company registered successfully. You can now login.',
        company,
      );
    } catch (err: unknown) {
      this.handleMongoDuplicate(err);
      throw err;
    }
  }

  async create(dto: CreateCompanyDto) {
    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();

    await this.assertContactUnique(email, phone);

    const hashedPassword = await this.passwordService.hash(dto.adminPassword);

    try {
      const company = await this.companyModel.create({
        name: dto.name.trim(),
        email,
        phone,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        status: dto.status ?? CompanyStatus.ACTIVE,
        planType: SubscriptionPlanType.FREE,
      });

      const admin = await this.userModel.create({
        fullName: dto.adminFullName.trim(),
        email,
        phone,
        password: hashedPassword,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: company._id,
        isEmailVerified: true,
      });

      await this.subscriptionModel.create({
        companyId: company._id,
        planType: SubscriptionPlanType.FREE,
        status: SubscriptionStatus.ACTIVE,
        vehicleLimit: company.vehicleLimit,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      return this.responseService.created(
        'Company and company admin created successfully. Admin can login with the provided email and password.',
        { company, admin: { id: admin._id, email: admin.email, role: admin.role } },
      );
    } catch (err: unknown) {
      this.handleMongoDuplicate(err);
      throw err;
    }
  }

  async findAll(status?: CompanyStatus) {
    const filter = status ? { status } : {};
    const items = await this.companyModel.find(filter).sort({ createdAt: -1 }).lean();

    const counts = await this.vehicleModel.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: '$companyId', count: { $sum: 1 } } },
    ]);
    const countByCompany = new Map(
      counts.map((row) => [String(row._id), row.count]),
    );

    const enriched = items.map((company) => ({
      ...company,
      vehicleCount: countByCompany.get(String(company._id)) ?? 0,
    }));

    return this.responseService.success('Companies fetched successfully', enriched);
  }

  async findOne(id: string) {
    const item = await this.companyModel.findById(id);
    if (!item) {
      throw new NotFoundException('Company not found');
    }
    return this.responseService.success('Company fetched successfully', item);
  }

  async approve(id: string) {
    const company = await this.companyModel.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (company.status !== CompanyStatus.PENDING) {
      throw new BadRequestException('Only pending companies can be approved');
    }

    company.status = CompanyStatus.ACTIVE;
    await company.save();

    await this.userModel.updateMany(
      { companyId: company._id, role: UserRole.COMPANY_ADMIN },
      { status: UserStatus.ACTIVE },
    );

    return this.responseService.success('Company approved successfully', company);
  }

  async reject(id: string) {
    const company = await this.companyModel.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (company.status !== CompanyStatus.PENDING) {
      throw new BadRequestException('Only pending companies can be rejected');
    }

    company.status = CompanyStatus.REJECTED;
    await company.save();

    await this.userModel.updateMany(
      { companyId: company._id },
      { status: UserStatus.INACTIVE },
    );

    return this.responseService.success('Company rejected', company);
  }

  async suspend(id: string) {
    const company = await this.companyModel.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (company.status === CompanyStatus.REJECTED) {
      throw new BadRequestException('Rejected companies cannot be suspended');
    }

    company.status = CompanyStatus.SUSPENDED;
    await company.save();

    await this.userModel.updateMany(
      { companyId: company._id },
      { status: UserStatus.SUSPENDED },
    );

    return this.responseService.success('Company suspended', company);
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const existing = await this.companyModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const email = dto.email ? normalizeEmail(dto.email) : existing.email;
    const phone = dto.phone?.trim() ?? existing.phone;

    if (dto.email || dto.phone) {
      await this.assertContactUnique(email, phone, id);
    }

    try {
      const item = await this.companyModel.findByIdAndUpdate(
        id,
        { ...dto, ...(dto.email ? { email } : {}), ...(dto.phone ? { phone } : {}) },
        { new: true },
      );
      return this.responseService.success('Company updated successfully', item);
    } catch (err: unknown) {
      this.handleMongoDuplicate(err);
      throw err;
    }
  }

  async remove(id: string) {
    const item = await this.companyModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Company not found');
    }
    return this.responseService.success('Company deleted successfully');
  }

  async listSubAdmins(companyId: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const admins = company.subAdmins ?? [];
    const permissionKeys = new Set<string>();
    admins.forEach((a) => a.permissions.forEach((p) => permissionKeys.add(p)));

    const stats = {
      total: admins.length,
      active: admins.filter((a) => a.status === 'ACTIVE').length,
      pending: admins.filter((a) => a.status === 'PENDING').length,
      rolesDefined: permissionKeys.size,
    };

    return this.responseService.success('Company sub-admins fetched', {
      admins,
      stats,
    });
  }

  async addSubAdmin(companyId: string, dto: AddCompanySubAdminDto) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const email = normalizeEmail(dto.email);
    const existing = company.subAdmins ?? [];

    if (existing.length >= company.maxAdmins) {
      throw new BadRequestException(
        `Sub-admin limit reached (${company.maxAdmins}). Upgrade your plan for more seats.`,
      );
    }

    if (existing.some((a) => normalizeEmail(a.email) === email)) {
      throw new BadRequestException('A sub-admin with this email already exists');
    }

    if (normalizeEmail(company.email) === email) {
      throw new BadRequestException('Cannot add the primary company email as a sub-admin');
    }

    await this.assertEmailAvailableForSubAdmin(email, companyId);

    const updated = await this.companyModel.findByIdAndUpdate(
      companyId,
      {
        $push: {
          subAdmins: {
            name: dto.name.trim(),
            email,
            permissions: dto.permissions,
            status: 'PENDING',
            invitedAt: new Date(),
          },
        },
      },
      { new: true },
    );

    const admins = updated?.subAdmins ?? [];
    const permissionKeys = new Set<string>();
    admins.forEach((a) => a.permissions.forEach((p) => permissionKeys.add(p)));

    return this.responseService.success('Sub-admin invited', {
      admins,
      stats: {
        total: admins.length,
        active: admins.filter((a) => a.status === 'ACTIVE').length,
        pending: admins.filter((a) => a.status === 'PENDING').length,
        rolesDefined: permissionKeys.size,
      },
    });
  }

  async removeSubAdmin(companyId: string, email: string) {
    const normalized = normalizeEmail(email);
    const updated = await this.companyModel.findByIdAndUpdate(
      companyId,
      { $pull: { subAdmins: { email: normalized } } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Company not found');
    }

    const admins = updated.subAdmins ?? [];
    const permissionKeys = new Set<string>();
    admins.forEach((a) => a.permissions.forEach((p) => permissionKeys.add(p)));

    return this.responseService.success('Sub-admin removed', {
      admins,
      stats: {
        total: admins.length,
        active: admins.filter((a) => a.status === 'ACTIVE').length,
        pending: admins.filter((a) => a.status === 'PENDING').length,
        rolesDefined: permissionKeys.size,
      },
    });
  }

  private async assertEmailAvailableForSubAdmin(
    email: string,
    companyId: string,
  ) {
    const normalizedEmail = normalizeEmail(email);

    const otherCompany = await this.companyModel.findOne({
      _id: { $ne: companyId },
      email: normalizedEmail,
    });
    if (otherCompany) {
      throw new ConflictException('This email is already registered with another company');
    }

    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (user) {
      throw new ConflictException('This email is already used by another user account');
    }
  }

  private handleMongoDuplicate(err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      const key = (err as { keyPattern?: Record<string, number> }).keyPattern;
      if (key?.email) {
        throw new ConflictException('This email is already in use');
      }
      if (key?.phone) {
        throw new ConflictException('This phone number is already in use');
      }
      throw new ConflictException('Email or phone already exists');
    }
  }
}

