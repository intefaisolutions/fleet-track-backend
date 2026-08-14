import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
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
import { LicenseValidationService } from '../../licenses/services/license-validation.service';
import { MailService } from '../../mail/mail.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../../subscriptions/schemas/subscription.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import {
  LicenseResendLog,
  LicenseResendLogDocument,
  LicenseResendStatus,
} from '../schemas/license-resend-log.schema';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';
import { SuspendCompanyDto } from '../dto/suspend-company.dto';
import { AddCompanySubAdminDto } from '../dto/company-sub-admin.dto';
import {
  restoreUniqueValue,
  restoreUpdate,
  softDeleteUpdate,
  tombstoneUniqueValue,
  withNotDeleted,
} from '../../common/utils/soft-delete.util';
import {
  assertCompanySubAdminPermissions,
  COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS,
} from '../constants/company-sub-admin-permissions.constant';
import { verifyGoogleIdToken } from '../../common/utils/google-id-token.util';
import { ActivateLicenseDto } from '../dto/activate-license.dto';
import {
  LicenseValidationFailure,
  licenseValidationMessage,
} from '../../licenses/constants/license-validation.messages';

/** Cooldown between license activation email resends */
export const LICENSE_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Legacy rows often store companyId as a plain string; newer rows use ObjectId.
 * Match both so Super Admin company detail / counts stay accurate.
 */
function companyIdMatch(companyId: string | Types.ObjectId) {
  const asString = String(companyId);
  const values: Array<string | Types.ObjectId> = [asString];
  if (Types.ObjectId.isValid(asString)) {
    values.push(new Types.ObjectId(asString));
  }
  return { companyId: { $in: values } };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 4))}@${domain}`;
}

/** Legacy docs without the flag are treated as already activated. */
export function companyRequiresLicenseActivation(
  company: Pick<Company, 'licenseId' | 'licenseActivated'>,
): boolean {
  if (!company.licenseId) return false;
  if (company.licenseActivated === undefined || company.licenseActivated === null) {
    return false;
  }
  return company.licenseActivated === false;
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(LicenseResendLog.name)
    private readonly licenseResendLogModel: Model<LicenseResendLogDocument>,
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
    private readonly licensesService: LicensesService,
    private readonly licenseValidation: LicenseValidationService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private async assertContactUnique(
    email: string,
    phone: string,
    excludeCompanyId?: string,
  ) {
    await this.licenseValidation.assertCompanyEmailNotDuplicate(
      email,
      excludeCompanyId,
    );

    const normalizedPhone = normalizePhone(phone);

    const companies = await this.companyModel.find(
      withNotDeleted({
        ...(excludeCompanyId ? { _id: { $ne: excludeCompanyId } } : {}),
        phone: { $exists: true, $nin: [null, ''] },
      }),
    );

    for (const c of companies) {
      if (normalizePhone(c.phone) === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const users = await this.userModel.find(
      withNotDeleted({
        phone: { $exists: true, $nin: [null, ''] },
      }),
    );

    for (const u of users) {
      if (
        excludeCompanyId &&
        u.companyId?.toString() === excludeCompanyId &&
        u.role === UserRole.COMPANY_ADMIN
      ) {
        continue;
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

    const license = await this.licensesService.validateForRegistration(
      dto.licenseKey,
    );

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
        licenseActivated: false,
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

      // Do not await SMTP — slow/hanging mail was causing client timeouts while
      // the company was already created (false "Registration failed" toast).
      void this.mailService
        .sendCompanyWelcomeEmail({
          to: email,
          companyName: company.name,
          adminName,
          licenseKey: license.licenseKey,
          planType: license.planType,
          validUntil: new Date(license.validUntil).toISOString().slice(0, 10),
        })
        .then((emailed) => {
          if (!emailed) {
            this.logger.warn(
              `Company registered (id=${company._id}) but welcome email was not sent (mail disabled or SMTP not configured)`,
            );
          }
        })
        .catch((mailErr: unknown) => {
          this.logger.error(
            `Company registered successfully (id=${company._id}) but welcome email failed for ${email}`,
            mailErr instanceof Error ? mailErr.stack : String(mailErr),
          );
        });

      return this.responseService.created(
        'Company registered successfully. Check your email for the license key, then log in to activate.',
        {
          id: company._id,
          name: company.name,
          email: company.email,
          phone: company.phone,
          planType: company.planType,
          licenseActivated: company.licenseActivated,
        },
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
        licenseActivated: true,
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
    const items = await this.companyModel
      .find(withNotDeleted(filter))
      .sort({ createdAt: -1 })
      .lean();

    const counts = await this.vehicleModel.aggregate<{ _id: unknown; count: number }>([
      { $match: withNotDeleted({}) },
      {
        $group: {
          // Normalize string vs ObjectId companyId keys
          _id: { $toString: '$companyId' },
          count: { $sum: 1 },
        },
      },
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
    const item = await this.companyModel
      .findOne(withNotDeleted({ _id: id }))
      .lean();
    if (!item) {
      throw new NotFoundException('Company not found');
    }

    const companyOid = item._id;
    const byCompany = companyIdMatch(companyOid);
    const [
      licenseDetails,
      subscription,
      vehicleCount,
      driverCount,
      expenseStats,
      ownerCount,
    ] = await Promise.all([
      this.licensesService.getDetailsForCompany(id),
      this.subscriptionModel.findOne({ companyId: companyOid }).lean(),
      this.vehicleModel.countDocuments(withNotDeleted(byCompany)),
      this.driverModel.countDocuments(withNotDeleted(byCompany)),
      this.expenseModel.aggregate<{ count: number; total: number }>([
        { $match: withNotDeleted(byCompany) },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$amount' },
          },
        },
      ]),
      this.userModel.countDocuments(
        withNotDeleted({
          ...byCompany,
          role: UserRole.VEHICLE_OWNER,
        }),
      ),
    ]);

    // maxAdmins seats are for invited sub-admins only — primary COMPANY_ADMIN is excluded
    const adminCount = (item.subAdmins ?? []).length;

    const licenseValidUntil =
      licenseDetails?.validUntil ??
      subscription?.currentPeriodEnd ??
      undefined;

    const expenseRow = expenseStats[0];
    const enriched = {
      ...item,
      licenseKey: licenseDetails?.licenseKey,
      licenseValidUntil: licenseValidUntil
        ? new Date(licenseValidUntil).toISOString()
        : undefined,
      planType: item.planType ?? licenseDetails?.planType ?? subscription?.planType,
      subscription: subscription
        ? {
            planType: subscription.planType,
            status: subscription.status,
            billingPeriod: subscription.billingPeriod,
            startDate: subscription.startDate
              ? new Date(subscription.startDate).toISOString()
              : undefined,
            currentPeriodEnd: subscription.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toISOString()
              : undefined,
            originalPrice: subscription.originalPrice,
            amountPaid: subscription.amountPaid,
            vehicleLimit: subscription.vehicleLimit ?? item.vehicleLimit,
          }
        : null,
      stats: {
        vehicleCount,
        driverCount,
        expenseCount: expenseRow?.count ?? 0,
        expenseTotal: expenseRow?.total ?? 0,
        ownerCount,
        adminCount,
      },
    };

    return this.responseService.success('Company fetched successfully', enriched);
  }

  /** Super Admin company drill-down: fleet, drivers, expenses, payments, users */
  async findDetail(id: string) {
    const base = await this.findOne(id);
    const company = base.data as Record<string, unknown> & { _id: Types.ObjectId };
    const byCompany = companyIdMatch(company._id);

    const [vehicles, drivers, expenses, payments, users] = await Promise.all([
      this.vehicleModel
        .find(withNotDeleted(byCompany))
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('assignedDriverId', 'fullName phone')
        .populate('ownerId', 'fullName email')
        .lean(),
      this.driverModel
        .find(withNotDeleted(byCompany))
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('userId', 'email fullName phone')
        .lean(),
      this.expenseModel
        .find(withNotDeleted(byCompany))
        .sort({ expenseDate: -1, createdAt: -1 })
        .limit(200)
        .populate('vehicleId', 'registrationNumber make modelName')
        .populate('recordedBy', 'fullName role')
        .lean(),
      this.paymentModel
        .find(byCompany)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.userModel
        .find(
          withNotDeleted({
            ...byCompany,
            // Primary / sub COMPANY_ADMIN are not "fleet users" — Owners & Drivers only
            role: {
              $in: [UserRole.VEHICLE_OWNER, UserRole.DRIVER],
            },
          }),
        )
        .select('fullName email phone role status createdAt')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    return this.responseService.success('Company detail fetched successfully', {
      ...company,
      vehicles,
      drivers,
      expenses,
      payments,
      users,
    });
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
    const item = await this.companyModel.findOne(withNotDeleted({ _id: id }));
    if (!item) {
      throw new NotFoundException('Company not found');
    }

    const objectId = new Types.ObjectId(id);
    const soft = softDeleteUpdate({
      status: CompanyStatus.SUSPENDED,
      email: tombstoneUniqueValue(item.email, id),
      phone: tombstoneUniqueValue(item.phone, id),
    });

    await this.companyModel.findByIdAndUpdate(id, soft);

    try {
      // Soft-cascade: never hard-delete related records (payments/wallets kept for audit)
      await Promise.all([
        this.userModel.updateMany(
          withNotDeleted({ companyId: objectId }),
          softDeleteUpdate({ status: UserStatus.INACTIVE }),
        ),
        this.subscriptionModel.updateMany(
          withNotDeleted({ companyId: objectId }),
          softDeleteUpdate({ status: SubscriptionStatus.CANCELLED }),
        ),
        this.vehicleModel.updateMany(
          withNotDeleted({ companyId: objectId }),
          softDeleteUpdate(),
        ),
        this.companyModel.db.collection('drivers').updateMany(
          { companyId: objectId, isDeleted: { $ne: true } },
          { $set: softDeleteUpdate() },
        ),
        this.companyModel.db.collection('expenses').updateMany(
          { companyId: objectId, isDeleted: { $ne: true } },
          { $set: softDeleteUpdate() },
        ),
      ]);

      // Tombstone user unique contacts so emails/phones can be reused
      const deletedUsers = await this.userModel
        .find({ companyId: objectId, isDeleted: true })
        .select('_id email phone');
      await Promise.all(
        deletedUsers.map((u) => {
          const uid = u._id.toString();
          return this.userModel.updateOne(
            { _id: u._id },
            {
              $set: {
                email: tombstoneUniqueValue(u.email, uid),
                phone: tombstoneUniqueValue(u.phone, uid),
              },
            },
          );
        }),
      );
    } catch {
      // Ignore cascading errors — company row is already soft-deleted
    }

    return this.responseService.success('Company deleted successfully');
  }

  async restore(id: string) {
    const item = await this.companyModel.findOne({ _id: id, isDeleted: true });
    if (!item) {
      throw new NotFoundException('Deleted company not found');
    }

    await this.companyModel.findByIdAndUpdate(
      id,
      restoreUpdate({
        status: CompanyStatus.ACTIVE,
        email: restoreUniqueValue(item.email, id),
        phone: restoreUniqueValue(item.phone, id),
      }),
    );

    return this.responseService.success(
      'Company restored successfully. Related records remain soft-deleted — restore them individually if needed.',
    );
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
      maxAdmins: company.maxAdmins,
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
        `Sub-admin limit reached (${existing.length}/${company.maxAdmins}). Primary Company Admin is not counted in this limit. Upgrade your plan for more seats.`,
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
      maxAdmins: updated?.maxAdmins ?? company.maxAdmins,
    });
  }

  async updateSubAdmin(
    companyId: string,
    email: string,
    dto: { permissions: string[]; name?: string },
  ) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const normalized = normalizeEmail(email);
    const existing = company.subAdmins ?? [];
    const index = existing.findIndex(
      (a) => normalizeEmail(a.email) === normalized,
    );
    if (index < 0) {
      throw new NotFoundException('Sub-admin not found');
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
    if (permissions.length === 0) {
      throw new BadRequestException('Select at least one permission');
    }

    const nextName = dto.name?.trim() || existing[index].name;
    existing[index].permissions = permissions;
    existing[index].name = nextName;
    company.subAdmins = existing;
    company.markModified('subAdmins');
    await company.save();

    // Match string + ObjectId companyId (legacy rows) so User.permissions stay in sync
    // with company.subAdmins (sidebar reads User / login profile).
    const subUser = await this.userModel.findOne(
      withNotDeleted({
        email: normalized,
        role: UserRole.COMPANY_ADMIN,
        ...companyIdMatch(companyId),
      }),
    );
    if (subUser) {
      subUser.permissions = permissions;
      if (dto.name?.trim()) {
        subUser.fullName = nextName;
      }
      await subUser.save();
    } else {
      this.logger.warn(
        `Sub-admin permissions updated on company but user not found for ${normalized}`,
      );
    }

    const admins = company.subAdmins ?? [];
    const permissionKeys = new Set<string>();
    admins.forEach((a) => a.permissions.forEach((p) => permissionKeys.add(p)));

    return this.responseService.success('Sub-admin permissions updated', {
      admins,
      stats: {
        total: admins.length,
        active: admins.filter((a) => a.status === 'ACTIVE').length,
        pending: admins.filter((a) => a.status === 'PENDING').length,
        rolesDefined: permissionKeys.size,
      },
      maxAdmins: company.maxAdmins,
    });
  }

  async removeSubAdmin(companyId: string, email: string) {
    const normalized = normalizeEmail(email);

    // Soft-delete the user account so they lose access (record retained)
    const subUser = await this.userModel.findOne(
      withNotDeleted({ email: normalized, companyId }),
    );
    if (subUser) {
      const uid = subUser._id.toString();
      await this.userModel.findByIdAndUpdate(
        subUser._id,
        softDeleteUpdate({
          status: UserStatus.INACTIVE,
          email: tombstoneUniqueValue(subUser.email, uid),
          phone: tombstoneUniqueValue(subUser.phone, uid),
          refreshTokenHash: undefined,
        }),
      );
    }

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
      maxAdmins: updated.maxAdmins,
    });
  }

  async getLicenseActivationStatus(companyId: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const requiresActivation = companyRequiresLicenseActivation(company);
    const cooldown = await this.getLicenseResendCooldown(companyId);

    return this.responseService.success('License activation status', {
      companyName: company.name,
      email: company.email,
      maskedEmail: maskEmail(company.email),
      licenseActivated: !requiresActivation,
      requiresActivation,
      resendCooldownSeconds: cooldown.remainingSeconds,
      canResendEmail: cooldown.remainingSeconds === 0,
    });
  }

  async activateLicense(companyId: string, dto: ActivateLicenseDto) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (!companyRequiresLicenseActivation(company)) {
      return this.responseService.success(
        'Your license key has been verified successfully. Welcome to FleetTrack!',
        {
          companyName: company.name,
          licenseActivated: true,
          requiresActivation: false,
        },
      );
    }

    const license = await this.licenseValidation.validateForActivation(
      dto.licenseKey,
      companyId,
    );

    company.licenseActivated = true;
    if (!company.licenseId) {
      company.licenseId = license._id as Types.ObjectId;
    }
    await company.save();

    return this.responseService.success(
      'Your license key has been verified successfully. Welcome to FleetTrack!',
      {
        companyName: company.name,
        licenseActivated: true,
        requiresActivation: false,
      },
    );
  }

  /**
   * Resends the same license key via the existing activation email template.
   * Enforces a 60s cooldown and writes an audit log entry.
   */
  async resendLicenseActivationEmail(
    companyId: string,
    requestedByUserId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const cooldown = await this.getLicenseResendCooldown(companyId);
    if (cooldown.remainingSeconds > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Please wait ${cooldown.remainingSeconds} seconds before requesting another email.`,
          error: 'Too Many Requests',
          data: {
            resendCooldownSeconds: cooldown.remainingSeconds,
            canResendEmail: false,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const licenseDetails =
      await this.licensesService.getDetailsForCompany(companyId);
    if (!licenseDetails?.licenseKey) {
      throw new BadRequestException(
        'No license key is linked to this company. Please contact support.',
      );
    }

    const admin = await this.userModel
      .findOne({ companyId: company._id, role: UserRole.COMPANY_ADMIN })
      .sort({ createdAt: 1 });

    const auditBase = {
      companyId: company._id,
      requestedBy: requestedByUserId
        ? new Types.ObjectId(requestedByUserId)
        : undefined,
      email: company.email,
      licenseKey: licenseDetails.licenseKey,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    };

    try {
    await this.mailService.sendCompanyWelcomeEmail({
      to: company.email,
      companyName: company.name,
      adminName: admin?.fullName ?? 'Admin',
      licenseKey: licenseDetails.licenseKey,
      planType: company.planType,
      validUntil: licenseDetails.validUntil
        ? new Date(licenseDetails.validUntil).toISOString().slice(0, 10)
        : 'N/A',
    });

      await this.licenseResendLogModel.create({
        ...auditBase,
        status: LicenseResendStatus.SUCCESS,
      });

      return this.responseService.success(
        'License key has been resent to your registered email address.',
        {
          maskedEmail: maskEmail(company.email),
          resendCooldownSeconds: LICENSE_RESEND_COOLDOWN_SECONDS,
          canResendEmail: false,
        },
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send license email';

      await this.licenseResendLogModel.create({
        ...auditBase,
        status: LicenseResendStatus.FAILED,
        errorMessage,
      });

      throw new BadRequestException(
        'Failed to send license email. Please try again or contact support.',
      );
    }
  }

  private async getLicenseResendCooldown(companyId: string): Promise<{
    remainingSeconds: number;
  }> {
    const lastSuccess = await this.licenseResendLogModel
      .findOne({
        companyId: new Types.ObjectId(companyId),
        status: LicenseResendStatus.SUCCESS,
      })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();

    if (!lastSuccess?.createdAt) {
      return { remainingSeconds: 0 };
    }

    const elapsedMs = Date.now() - new Date(lastSuccess.createdAt).getTime();
    const remainingMs = LICENSE_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
    if (remainingMs <= 0) {
      return { remainingSeconds: 0 };
    }
    return { remainingSeconds: Math.ceil(remainingMs / 1000) };
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
      throw new ConflictException(
        licenseValidationMessage(LicenseValidationFailure.EMAIL_DUPLICATE),
      );
    }

    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (user) {
      throw new ConflictException(
        licenseValidationMessage(LicenseValidationFailure.EMAIL_DUPLICATE),
      );
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
        throw new ConflictException(
          licenseValidationMessage(LicenseValidationFailure.EMAIL_DUPLICATE),
        );
      }
      if (key?.phone) {
        throw new ConflictException('Phone number already exists');
      }
      throw new ConflictException('Email or phone already exists');
    }
  }
}

