import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompanyStatus, UserRole, UserStatus } from '../../common/enums';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact.util';
import { ResponseService } from '../../common/responses/response.service';
import { PasswordService } from '../../auth/services/password.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
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

    const hashedPassword = await this.passwordService.hash(dto.password);

    try {
      const company = await this.companyModel.create({
        name: dto.companyName.trim(),
        email,
        phone,
        status: CompanyStatus.PENDING,
      });

      await this.userModel.create({
        fullName: dto.adminName.trim(),
        email,
        phone,
        password: hashedPassword,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.PENDING_APPROVAL,
        companyId: company._id,
        isEmailVerified: false,
      });

      return this.responseService.created(
        'Company registration submitted. Awaiting Super Admin approval.',
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

    try {
      const created = await this.companyModel.create({
        ...dto,
        email,
        phone,
        status: dto.status ?? CompanyStatus.ACTIVE,
      });
      return this.responseService.created('Company created successfully', created);
    } catch (err: unknown) {
      this.handleMongoDuplicate(err);
      throw err;
    }
  }

  async findAll(status?: CompanyStatus) {
    const filter = status ? { status } : {};
    const items = await this.companyModel.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Companies fetched successfully', items);
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
