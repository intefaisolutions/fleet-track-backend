import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
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
import { MailService } from '../../mail/mail.service';
import { User, UserSchema, UserDocument } from '../../users/schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../../subscriptions/schemas/subscription.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';
import { SuspendCompanyDto } from '../dto/suspend-company.dto';
import { AddCompanySubAdminDto } from '../dto/company-sub-admin.dto';
import {
  assertCompanySubAdminPermissions,
  COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS,
} from '../constants/company-sub-admin-permissions.constant';
import { verifyGoogleIdToken } from '../../common/utils/google-id-token.util';

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
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    });

    for (const c of companies) {
      if (normalizeEmail(c.email) === normalizedEmail) {
        throw new ConflictException('Email already exists');
      }
      if (normalizePhone(c.phone) === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const users = await this.userModel.find({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    });

    for (const u of users) {
      if (
        excludeCompanyId &&
        u.companyId?.toString() === excludeCompanyId &&
        u.role === UserRole.COMPANY_ADMIN
      ) {
        continue;
      }
      if (normalizeEmail(u.email) === normalizedEmail) {
        throw new ConflictException('Email already exists');
      }
      if (normalizePhone(u.phone) === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }
  }

  async register(dto: RegisterCompanyDto) {
    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();

    await this.assertContactUnique(email, phone);

    const license = await this.licensesService.validateForRegistration(dto.licenseKey);

    let hashedPassword: string;
    let adminName = dto.adminName.trim();

    if (dto.googleIdToken) {
      const googleProfile = await verifyGoogleIdToken(
        dto.googleIdToken,
        this.configService.get<string>('app.googleClientId'),
      );
      if (googleProfile.email !== email) {
        throw new BadRequestException(
          'Registration email must match your Google account email',
        );
      }
      if (!adminName && googleProfile.name) {
        adminName = googleProfile.name.trim();
      }
      hashedPassword = await this.passwordService.hash(
        randomBytes(32).toString('hex'),
      );
    } else {
      if (!dto.password) {
        throw new BadRequestException('Password is required when not using Google sign-in');
      }
      hashedPassword = await this.passwordService.hash(dto.password);
    }

    if (adminName.length < 2) {
      throw new BadRequestException('Admin full name is required');
    }

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
        fullName: adminName,
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
    const item = await this.companyModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('Company not found');
    }

    const [licenseDetails, subscription] = await Promise.all([
      this.licensesService.getDetailsForCompany(id),
      this.subscriptionModel.findOne({ companyId: item._id }).lean(),
    ]);

    const licenseValidUntil =
      licenseDetails?.validUntil ??
      subscription?.currentPeriodEnd ??
      undefined;

    const enriched = {
      ...item,
      licenseKey: licenseDetails?.licenseKey,
      licenseValidUntil: licenseValidUntil
        ? new Date(licenseValidUntil).toISOString()
        : undefined,
      planType: item.planType ?? licenseDetails?.planType,
    };

    return this.responseService.success('Company fetched successfully', enriched);
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

  async suspend(id: string, dto: SuspendCompanyDto) {
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

    // Retrieve subscription or license valid until
    const subscription = await this.subscriptionModel.findOne({ companyId: company._id }).lean();
    let validityStr = undefined;
    if (subscription?.currentPeriodEnd) {
      validityStr = new Date(subscription.currentPeriodEnd).toISOString().split('T')[0];
    } else {
      const license = await this.licensesService.getDetailsForCompany(id);
      if (license?.validUntil) {
        validityStr = new Date(license.validUntil).toISOString().split('T')[0];
      }
    }

    // Send email to company primary email
    await this.mailService.sendCompanySuspensionEmail(
      company.email,
      company.name,
      dto.reason,
      validityStr,
    );

    return this.responseService.success('Company suspended', company);
  }

  async activate(id: string) {
    const company = await this.companyModel.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (company.status !== CompanyStatus.SUSPENDED) {
      throw new BadRequestException('Only suspended companies can be reactivated');
    }

    company.status = CompanyStatus.ACTIVE;
    await company.save();

    await this.userModel.updateMany(
      { companyId: company._id, status: UserStatus.SUSPENDED },
      { status: UserStatus.ACTIVE },
    );

    return this.responseService.success('Company reactivated', company);
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
        { returnDocument: 'after' },
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

    const objectId = new Types.ObjectId(id);

    try {
      await Promise.all([
        this.companyModel.db.collection('users').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('subscriptions').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('vehicles').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('payments').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('drivers').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('expenses').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('wallets').deleteMany({ companyId: objectId }),
        this.companyModel.db.collection('wallettransactions').deleteMany({ companyId: objectId }),
      ]);
    } catch (err) {
      // Ignore cascading errors
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

    try {
      assertCompanySubAdminPermissions(dto.permissions);
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid sub-admin permissions',
      );
    }

    const permissions = dto.permissions.filter((p) =>
      (COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS as readonly string[]).includes(p),
    );

    await this.assertEmailAvailableForSubAdmin(email, companyId);

    const rawPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
    const hashedPassword = await this.passwordService.hash(rawPassword);
    const fakePhone = `SUB-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    await this.userModel.create({
      fullName: dto.name.trim(),
      email,
      phone: fakePhone,
      password: hashedPassword,
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company._id,
      isEmailVerified: true,
      permissions,
    });

    const updated = await this.companyModel.findByIdAndUpdate(
      companyId,
      {
        $push: {
          subAdmins: {
            name: dto.name.trim(),
            email,
            permissions,
            status: 'ACTIVE',
            invitedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after' },
    );

    const loginUrl = this.configService.get<string>('app.adminAppUrl') || 'http://localhost:5173/login';
    await this.mailService.sendSubAdminInviteEmail(
      email,
      dto.name.trim(),
      company.name,
      rawPassword,
      loginUrl
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
    
    // Remove the actual user account so they lose access
    await this.userModel.findOneAndDelete({ email: normalized, companyId });

    const updated = await this.companyModel.findByIdAndUpdate(
      companyId,
      { $pull: { subAdmins: { email: normalized } } },
      { returnDocument: 'after' },
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
      throw new ConflictException('Email already exists');
    }

    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (user) {
      throw new ConflictException('Email already exists');
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
        throw new ConflictException('Email already exists');
      }
      if (key?.phone) {
        throw new ConflictException('Phone number already exists');
      }
      throw new ConflictException('Email or phone already exists');
    }
  }
}

