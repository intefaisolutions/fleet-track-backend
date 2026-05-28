import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverStatus, UserRole, UserStatus } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import { PasswordService } from '../../auth/services/password.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
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
    private readonly responseService: ResponseService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateDriverDto, companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required to create a driver');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    const user = await this.userModel.create({
      fullName: dto.fullName.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone.trim(),
      password: hashedPassword,
      role: UserRole.DRIVER,
      status: UserStatus.ACTIVE,
      companyId,
      isEmailVerified: false,
    });

    const driver = await this.driverModel.create({
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      licenseNumber: dto.licenseNumber.trim(),
      status: dto.status ?? DriverStatus.ACTIVE,
      companyId,
      userId: user._id,
    });

    return this.responseService.created('Driver created successfully', {
      driver,
      userId: user._id,
    });
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
