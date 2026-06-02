import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverStatus, UserRole, UserStatus } from '../../common/enums';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { ResponseService } from '../../common/responses/response.service';
import { PasswordService } from '../../auth/services/password.service';
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
  ) {}

  private async assertContactUnique(email: string, phone: string) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const users = await this.userModel.find({
      $or: [{ email: normalizedEmail }, { phone }],
    });
    for (const u of users) {
      if (normalizeEmail(u.email) === normalizedEmail) {
        throw new ConflictException('This email is already used by another account');
      }
      if (normalizePhone(u.phone) === normalizedPhone) {
        throw new ConflictException('This phone number is already used by another account');
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

  private handleMongoDuplicate(err: unknown): never {
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
      throw new ConflictException('Duplicate value found');
    }
    throw err;
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

      return this.responseService.created('Driver created successfully', {
        driver,
        userId: user._id,
      });
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
      new: true,
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
