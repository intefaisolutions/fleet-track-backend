import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Vehicle, VehicleDocument } from '../schemas/vehicle.schema';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { AssignDriverDto } from '../dto/assign-driver.dto';
import {
  Subscription,
  SubscriptionDocument,
} from '../../subscriptions/schemas/subscription.schema';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly responseService: ResponseService,
  ) {}

  private async assertOwnerVehicle(id: string, ownerId: string) {
    const item = await this.vehicleModel.findById(id);
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }
    if (item.ownerId?.toString() !== ownerId) {
      throw new ForbiddenException('You can only manage your own vehicles');
    }
    return item;
  }

  private mapCreateDto(dto: CreateVehicleDto) {
    const registrationNumber = dto.registrationNumber ?? dto.vehicleNumber;
    const modelName = dto.modelName ?? dto.model;

    if (!registrationNumber) {
      throw new BadRequestException('vehicleNumber or registrationNumber is required');
    }
    if (!modelName) {
      throw new BadRequestException('model or modelName is required');
    }

    return {
      registrationNumber: registrationNumber.trim(),
      make: dto.make?.trim() || 'Fleet',
      modelName: modelName.trim(),
      vehicleType: dto.type,
      vin: dto.vin,
      status: dto.status,
      fuelType: dto.fuelType?.trim(),
      currentOdometerKm: dto.currentOdometerKm,
      year: dto.year,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      purchaseCost: dto.purchaseCost,
      imageUrl: dto.imageUrl,
      assignedDriverId: dto.assignedDriverId,
    };
  }

  async create(dto: CreateVehicleDto, companyId: string, ownerId?: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new BadRequestException('Company not found');
    }
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .lean();
    const planLimit = subscription?.vehicleLimit ?? company.vehicleLimit ?? 5;

    if (ownerId) {
      const ownerCount = await this.vehicleModel.countDocuments({ companyId, ownerId });
      if (ownerCount >= planLimit) {
        throw new BadRequestException(
          `Vehicle limit reached (${ownerCount}/${planLimit}). Upgrade your plan.`,
        );
      }
    } else {
      const vehicleCount = await this.vehicleModel.countDocuments({ companyId });
      if (vehicleCount >= company.vehicleLimit) {
        throw new BadRequestException(
          `Vehicle limit reached (${company.vehicleLimit}). Upgrade your plan.`,
        );
      }
    }

    const payload = this.mapCreateDto(dto);
    const created = await this.vehicleModel.create({
      ...payload,
      companyId,
      ...(ownerId ? { ownerId } : dto.ownerId ? { ownerId: dto.ownerId } : {}),
    });
    return this.responseService.created('Vehicle created successfully', created);
  }

  async findAll(companyId?: string, ownerId?: string) {
    const filter: Record<string, unknown> = {};
    if (companyId) filter.companyId = companyId;
    if (ownerId) filter.ownerId = ownerId;
    const items = await this.vehicleModel
      .find(filter)
      .populate('ownerId', 'fullName email')
      .populate('assignedDriverId', 'fullName phone')
      .sort({ createdAt: -1 });
    return this.responseService.success('Vehicles fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.vehicleModel
      .findById(id)
      .populate('ownerId', 'fullName email')
      .populate('assignedDriverId', 'fullName phone licenseNumber');
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.responseService.success('Vehicle fetched successfully', item);
  }

  async update(id: string, dto: UpdateVehicleDto, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerVehicle(id, ownerId);
    }
    const item = await this.vehicleModel.findByIdAndUpdate(id, dto, { new: true });
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.responseService.success('Vehicle updated successfully', item);
  }

  async assignDriver(id: string, dto: AssignDriverDto, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerVehicle(id, ownerId);
    }
    const item = await this.vehicleModel.findByIdAndUpdate(
      id,
      { assignedDriverId: dto.driverId },
      { new: true },
    );
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.responseService.success('Driver assigned successfully', item);
  }

  async remove(id: string, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerVehicle(id, ownerId);
    }
    const item = await this.vehicleModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.responseService.success('Vehicle deleted successfully');
  }
}
