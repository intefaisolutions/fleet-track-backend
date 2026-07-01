import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriverStatus, UserRole, UserStatus } from '../../common/enums';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { ResponseService } from '../../common/responses/response.service';
import { PasswordService } from '../../auth/services/password.service';
import { MailService } from '../../mail/mail.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Driver, DriverDocument } from '../schemas/driver.schema';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
    private readonly mailService: MailService,
  ) {}

  private async assertContactUnique(email: string, phone: string) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const users = await this.userModel.find({
      $or: [{ email: normalizedEmail }, { phone }],
    });
    for (const u of users) {
      if (normalizeEmail(u.email) === normalizedEmail) {
        throw new ConflictException('Email already exists');
      }
      if (normalizePhone(u.phone) === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const companies = await this.companyModel.find({
      $or: [{ email: normalizedEmail }, { phone }],
    });
    for (const c of companies) {
      if (normalizeEmail(c.email) === normalizedEmail) {
        throw new ConflictException('Email already exists');
      }
      if (normalizePhone(c.phone) === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }
  }

  private handleMongoDuplicate(err: unknown): never {
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
      throw new ConflictException('Duplicate value found');
    }
    throw err;
  }

  private idVariants(id: string | Types.ObjectId): Array<string | Types.ObjectId> {
    const str = id.toString();
    if (!Types.ObjectId.isValid(str)) return [str];
    return [str, new Types.ObjectId(str)];
  }

  /** Links or creates a drivers-collection record for a DRIVER user account. */
  async ensureProfileForUser(user: UserDocument): Promise<DriverDocument | null> {
    if (user.role !== UserRole.DRIVER || !user.companyId) {
      return null;
    }

    const companyId = user.companyId.toString();

    let driver = await this.driverModel.findOne({
      userId: { $in: this.idVariants(user._id) },
    });
    if (driver) {
      await this.syncProfileFromUser(user, driver);
      return driver;
    }

    driver = await this.driverModel.findOne({
      companyId,
      phone: user.phone.trim(),
    });
    if (driver) {
      driver.userId = user._id as Types.ObjectId;
      driver.fullName = user.fullName.trim();
      await driver.save();
      return driver;
    }

    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new BadRequestException('Company not found');
    }
    const driverCount = await this.driverModel.countDocuments({ companyId });
    if (driverCount >= company.maxDrivers) {
      throw new BadRequestException(
        `Driver limit reached (${company.maxDrivers}). Upgrade your plan.`,
      );
    }

    return this.driverModel.create({
      fullName: user.fullName.trim(),
      phone: user.phone.trim(),
      companyId,
      userId: user._id,
      status: DriverStatus.ACTIVE,
    });
  }

  private async syncProfileFromUser(user: UserDocument, driver: DriverDocument) {
    const fullName = user.fullName.trim();
    const phone = user.phone.trim();
    if (driver.fullName === fullName && driver.phone === phone) return;
    driver.fullName = fullName;
    driver.phone = phone;
    await driver.save();
  }

  async removeByUserId(userId: string) {
    await this.driverModel.deleteMany({
      userId: { $in: this.idVariants(userId) },
    });
  }

  async create(dto: CreateDriverDto, companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required to create a driver');
    }

    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new BadRequestException('Company not found');
    }
    const driverCount = await this.driverModel.countDocuments({ companyId });
    if (driverCount >= company.maxDrivers) {
      throw new BadRequestException(
        `Driver limit reached (${company.maxDrivers}). Upgrade your plan.`,
      );
    }

    const email = normalizeEmail(dto.email);
    const phone = dto.phone.trim();
    await this.assertContactUnique(email, phone);

    const hashedPassword = await this.passwordService.hash(dto.password);

    let user: UserDocument | null = null;
    try {
      user = await this.userModel.create({
        fullName: dto.fullName.trim(),
        email,
        phone,
        password: hashedPassword,
        role: UserRole.DRIVER,
        status: UserStatus.ACTIVE,
        companyId,
        isEmailVerified: false,
      });

      const driver = await this.driverModel.create({
        fullName: dto.fullName.trim(),
        phone,
        licenseNumber: dto.licenseNumber.trim(),
        status: dto.status ?? DriverStatus.ACTIVE,
        companyId,
        userId: user._id,
      });

      const welcomeEmailSent = await this.mailService.sendAccountWelcomeEmail({
        to: email,
        fullName: dto.fullName.trim(),
        password: dto.password,
        roleLabel: 'Driver',
        companyName: company.name,
      });

      return this.responseService.created(
        'Driver created successfully',
        {
          driver,
          userId: user._id,
        },
        { welcomeEmailSent },
      );
    } catch (err: unknown) {
      if (user?._id) {
        await this.userModel.findByIdAndDelete(user._id).catch(() => null);
      }
      this.handleMongoDuplicate(err);
    }
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.driverModel.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Drivers fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.driverModel.findById(id);
    if (!item) {
      throw new NotFoundException('Driver not found');
    }
    return this.responseService.success('Driver fetched successfully', item);
  }

  async update(id: string, dto: UpdateDriverDto) {
    const item = await this.driverModel.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
    });
    if (!item) {
      throw new NotFoundException('Driver not found');
    }
    return this.responseService.success('Driver updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.driverModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Driver not found');
    }
    return this.responseService.success('Driver deleted successfully');
  }
}
