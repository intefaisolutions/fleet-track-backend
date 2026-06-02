import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRole, UserStatus } from '../../common/enums';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { ResponseService } from '../../common/responses/response.service';
import { PasswordService } from '../../auth/services/password.service';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';

const SAFE_USER_SELECT =
  '-password -refreshTokenHash -passwordResetToken -passwordResetExpires';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
  ) {}

  private async assertCompanyUserLimit(companyId: string, role: UserRole) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new BadRequestException('Company not found');
    }

    if (role === UserRole.VEHICLE_OWNER) {
      const count = await this.userModel.countDocuments({
        companyId,
        role: UserRole.VEHICLE_OWNER,
      });
      if (count >= company.maxOwners) {
        throw new BadRequestException(
          `Vehicle owner limit reached (${company.maxOwners}). Upgrade your plan.`,
        );
      }
    }

    if (role === UserRole.COMPANY_ADMIN) {
      const count = await this.userModel.countDocuments({
        companyId,
        role: UserRole.COMPANY_ADMIN,
      });
      if (count >= company.maxAdmins) {
        throw new BadRequestException(
          `Company admin limit reached (${company.maxAdmins}).`,
        );
      }
    }
  }

  private async assertContactUnique(
    email: string,
    phone: string,
    excludeUserId?: string,
  ) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const users = await this.userModel.find(
      excludeUserId ? { _id: { $ne: excludeUserId } } : {},
    );

    for (const u of users) {
      if (normalizeEmail(u.email) === normalizedEmail) {
        throw new ConflictException('This email is already registered');
      }
      if (normalizePhone(u.phone) === normalizedPhone) {
        throw new ConflictException('This phone number is already registered');
      }
    }

    const companies = await this.companyModel.find({
      $or: [{ email: normalizedEmail }, { phone }],
    });

    for (const c of companies) {
      if (normalizeEmail(c.email) === normalizedEmail) {
        throw new ConflictException('This email is already used by a company');
      }
      if (normalizePhone(c.phone) === normalizedPhone) {
        throw new ConflictException('This phone number is already used by a company');
      }
    }
  }

  async superAdminExists(): Promise<boolean> {
    const count = await this.userModel.countDocuments({ role: UserRole.SUPER_ADMIN });
    return count > 0;
  }

  async resetSuperAdminCredentials(dto: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    profileImage?: string;
  }) {
    const superAdmin = await this.userModel
      .findOne({ role: UserRole.SUPER_ADMIN })
      .select('+password +refreshTokenHash +passwordResetToken +passwordResetExpires');

    if (!superAdmin) {
      throw new NotFoundException('Super Admin not found');
    }

    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();
    await this.assertContactUnique(email, phone, superAdmin._id.toString());

    superAdmin.fullName = dto.fullName;
    superAdmin.email = email;
    superAdmin.phone = phone;
    superAdmin.password = await this.passwordService.hash(dto.password);
    superAdmin.profileImage = dto.profileImage;
    superAdmin.status = UserStatus.ACTIVE;
    superAdmin.isEmailVerified = true;
    superAdmin.refreshTokenHash = undefined;
    superAdmin.passwordResetToken = undefined;
    superAdmin.passwordResetExpires = undefined;

    await superAdmin.save();

    return this.userModel.findById(superAdmin._id).select(SAFE_USER_SELECT);
  }

  async create(
    dto: CreateUserDto,
    options?: { status?: UserStatus; hashPassword?: boolean },
  ) {
    if (dto.role === UserRole.SUPER_ADMIN && (await this.superAdminExists())) {
      throw new ConflictException(
        'Super Admin already exists. Only one Super Admin is allowed in the system.',
      );
    }

    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();
    await this.assertContactUnique(email, phone);

    if (dto.companyId && dto.role) {
      await this.assertCompanyUserLimit(dto.companyId, dto.role);
    }

    const password =
      options?.hashPassword === false
        ? dto.password
        : await this.passwordService.hash(dto.password);

    try {
      const created = await this.userModel.create({
        ...dto,
        email,
        phone,
        password,
        status: options?.status ?? dto.status ?? UserStatus.ACTIVE,
        isEmailVerified: false,
      });

      const safe = await this.userModel.findById(created._id).select(SAFE_USER_SELECT);
      return this.responseService.created('User created successfully', safe);
    } catch (err: unknown) {
      this.handleMongoDuplicate(err);
      throw err;
    }
  }

  async findAll(companyId?: string, status?: UserStatus) {
    const filter: Record<string, unknown> = companyId ? { companyId } : {};
    if (status) {
      filter.status = status;
    }

    const items = await this.userModel
      .find(filter)
      .select(SAFE_USER_SELECT)
      .sort({ createdAt: -1 });

    return this.responseService.success('Users fetched successfully', items);
  }

  async findByEmail(email: string) {
    return this.userModel
      .findOne({ email: normalizeEmail(email) })
      .select('+password +refreshTokenHash +passwordResetToken +passwordResetExpires');
  }

  async findByPasswordResetToken(tokenHash: string) {
    return this.userModel
      .findOne({ passwordResetToken: tokenHash })
      .select('+password +passwordResetToken +passwordResetExpires');
  }

  async findById(id: string) {
    return this.userModel
      .findById(id)
      .select('+password +refreshTokenHash +passwordResetToken +passwordResetExpires');
  }

  async findOne(id: string) {
    const item = await this.userModel.findById(id).select(SAFE_USER_SELECT);

    if (!item) {
      throw new NotFoundException('User not found');
    }
    return this.responseService.success('User fetched successfully', item);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.userModel.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const email = dto.email ? normalizeEmail(dto.email) : existing.email;
    const phone = dto.phone?.trim() ?? existing.phone;

    if (dto.email || dto.phone) {
      await this.assertContactUnique(email, phone, id);
    }

    const update: Record<string, unknown> = { ...dto };
    if (dto.email) update.email = email;
    if (dto.phone) update.phone = phone;

    if (dto.password) {
      update.password = await this.passwordService.hash(dto.password);
    }

    try {
      const item = await this.userModel
        .findByIdAndUpdate(id, update, { new: true })
        .select(SAFE_USER_SELECT);

      if (!item) {
        throw new NotFoundException('User not found');
      }
      return this.responseService.success('User updated successfully', item);
    } catch (err: unknown) {
      this.handleMongoDuplicate(err);
      throw err;
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

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const item = await this.userModel
      .findByIdAndUpdate(id, { status: dto.status }, { new: true })
      .select(SAFE_USER_SELECT);

    if (!item) {
      throw new NotFoundException('User not found');
    }

    const labels: Record<UserStatus, string> = {
      [UserStatus.ACTIVE]: 'activated',
      [UserStatus.INACTIVE]: 'deactivated',
      [UserStatus.SUSPENDED]: 'suspended',
      [UserStatus.PENDING_APPROVAL]: 'set to pending approval',
    };

    return this.responseService.success(
      `User ${labels[dto.status]} successfully`,
      item,
    );
  }

  async verifyEmail(id: string) {
    const item = await this.userModel
      .findByIdAndUpdate(id, { isEmailVerified: true }, { new: true })
      .select(SAFE_USER_SELECT);

    if (!item) {
      throw new NotFoundException('User not found');
    }

    return this.responseService.success('Email marked as verified', item);
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string | null) {
    return this.userModel.findByIdAndUpdate(userId, {
      refreshTokenHash: refreshTokenHash ?? undefined,
    });
  }

  async setPasswordReset(userId: string, tokenHash: string, expires: Date) {
    return this.userModel.findByIdAndUpdate(userId, {
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    });
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      refreshTokenHash: undefined,
    });
  }

  async remove(id: string) {
    const item = await this.userModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('User not found');
    }
    return this.responseService.success('User deleted successfully');
  }
}
