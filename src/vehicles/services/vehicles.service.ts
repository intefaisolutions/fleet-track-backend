import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationType, UserRole } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import {
  isMongoDuplicateKey,
  isTransientMongoError,
  mongoUserMessage,
} from '../../common/utils/mongo-error.util';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Vehicle, VehicleDocument } from '../schemas/vehicle.schema';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { AssignDriverDto } from '../dto/assign-driver.dto';
import {
  Subscription,
  SubscriptionDocument,
} from '../../subscriptions/schemas/subscription.schema';
import {
  restoreUniqueValue,
  restoreUpdate,
  softDeleteUpdate,
  tombstoneUniqueValue,
  withNotDeleted,
} from '../../common/utils/soft-delete.util';

function normalizeRegistrationNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function registrationLookupVariants(value: string): string[] {
  const normalized = normalizeRegistrationNumber(value);
  const compact = normalized.replace(/\s+/g, '');
  return Array.from(new Set([normalized, compact, value.trim().toUpperCase()]));
}

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    private readonly responseService: ResponseService,
    @Optional() private readonly notificationsService?: NotificationsService,
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
      registrationNumber: normalizeRegistrationNumber(registrationNumber),
      make: dto.make?.trim() || 'Fleet',
      modelName: modelName.trim(),
      vehicleType: dto.type,
      vin: dto.vin?.trim() || undefined,
      status: dto.status,
      fuelType: dto.fuelType?.trim() || undefined,
      currentOdometerKm: dto.currentOdometerKm,
      year: dto.year,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      purchaseCost: dto.purchaseCost,
      imageUrl: dto.imageUrl?.trim() || undefined,
      assignedDriverId: dto.assignedDriverId || undefined,
    };
  }

  private idVariants(id: string): Array<string | Types.ObjectId> {
    if (!Types.ObjectId.isValid(id)) return [id];
    return [id, new Types.ObjectId(id)];
  }

  /**
   * Enforce 1 vehicle ↔ 1 driver: remove this driver from every other vehicle.
   */
  private async clearDriverFromOtherVehicles(
    driverId: string,
    keepVehicleId?: string,
  ) {
    if (!driverId) return;
    await this.vehicleModel.updateMany(
      withNotDeleted({
        assignedDriverId: { $in: this.idVariants(driverId) },
        ...(keepVehicleId
          ? { _id: { $nin: this.idVariants(keepVehicleId) } }
          : {}),
      }),
      { $unset: { assignedDriverId: '' } },
    );
  }

  private async assertRegistrationAvailable(
    companyId: string,
    registrationNumber: string,
    excludeId?: string,
  ) {
    const variants = registrationLookupVariants(registrationNumber);
    const existing = await this.vehicleModel.findOne(
      withNotDeleted({
        companyId,
        registrationNumber: { $in: variants },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      }),
    );
    if (existing) {
      throw new ConflictException(
        'A vehicle with this registration number already exists.',
      );
    }
  }

  async create(dto: CreateVehicleDto, companyId: string, ownerId?: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new BadRequestException('Company not found');
    }
    const subscription = await this.subscriptionModel
      .findOne(withNotDeleted({ companyId }))
      .lean();
    const planLimit = subscription?.vehicleLimit ?? company.vehicleLimit ?? 5;

    if (ownerId) {
      const ownerCount = await this.vehicleModel.countDocuments(
        withNotDeleted({ companyId, ownerId }),
      );
      if (ownerCount >= planLimit) {
        await this.notifyVehicleLimit(companyId, ownerCount, planLimit);
        throw new BadRequestException(
          `Vehicle limit reached (${ownerCount}/${planLimit}). Upgrade your plan.`,
        );
      }
      if (ownerCount >= planLimit - 1 && ownerCount < planLimit) {
        await this.notifyVehicleLimit(companyId, ownerCount + 1, planLimit, true);
      }
    } else {
      const vehicleCount = await this.vehicleModel.countDocuments(
        withNotDeleted({ companyId }),
      );
      if (vehicleCount >= company.vehicleLimit) {
        await this.notifyVehicleLimit(
          companyId,
          vehicleCount,
          company.vehicleLimit,
        );
        throw new BadRequestException(
          `Vehicle limit reached (${company.vehicleLimit}). Upgrade your plan.`,
        );
      }
      if (
        vehicleCount >= company.vehicleLimit - 1 &&
        vehicleCount < company.vehicleLimit
      ) {
        await this.notifyVehicleLimit(
          companyId,
          vehicleCount + 1,
          company.vehicleLimit,
          true,
        );
      }
    }

    const payload = this.mapCreateDto(dto);
    await this.assertRegistrationAvailable(companyId, payload.registrationNumber);

    if (payload.assignedDriverId) {
      await this.clearDriverFromOtherVehicles(payload.assignedDriverId);
    }

    const doc = {
      ...payload,
      companyId,
      ...(ownerId ? { ownerId } : dto.ownerId ? { ownerId: dto.ownerId } : {}),
    };

    try {
      const created = await this.vehicleModel.create(doc);
      return this.responseService.created('Vehicle created successfully', created);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictException(
          mongoUserMessage(err) ??
            'A vehicle with this registration number already exists.',
        );
      }
      if (isTransientMongoError(err)) {
        this.logger.warn(
          `Transient Mongo error on vehicle create, retrying once: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        try {
          const created = await this.vehicleModel.create(doc);
          return this.responseService.created(
            'Vehicle created successfully',
            created,
          );
        } catch (retryErr: unknown) {
          if (isMongoDuplicateKey(retryErr)) {
            throw new ConflictException(
              'A vehicle with this registration number already exists.',
            );
          }
          const msg = mongoUserMessage(retryErr);
          if (msg) throw new BadRequestException(msg);
          throw retryErr;
        }
      }
      const msg = mongoUserMessage(err);
      if (msg) throw new BadRequestException(msg);
      throw err;
    }
  }

  private async notifyVehicleLimit(
    companyId: string,
    used: number,
    limit: number,
    nearOnly = false,
  ) {
    try {
      const admins = await this.userModel
        .find(withNotDeleted({ companyId, role: UserRole.COMPANY_ADMIN }))
        .select('_id')
        .lean();
      await this.notificationsService?.notify({
        userIds: admins.map((a) => a._id.toString()),
        companyId,
        type: NotificationType.VEHICLE_LIMIT,
        title: nearOnly ? 'Vehicle limit almost reached' : 'Vehicle limit reached',
        message: nearOnly
          ? `Fleet is at ${used}/${limit} vehicles. Upgrade soon to add more.`
          : `Vehicle limit reached (${used}/${limit}). Upgrade your plan to add more vehicles.`,
        entityType: 'company',
        entityId: companyId,
        meta: { used, limit },
        dedupeKey: `vehicle-limit:${companyId}:${used}:${limit}:${nearOnly ? 'near' : 'full'}`,
      });
    } catch (err) {
      this.logger.warn('Vehicle limit notification failed', err);
    }
  }

  async findAll(companyId?: string, ownerId?: string) {
    const filter: Record<string, unknown> = {};
    if (companyId) filter.companyId = companyId;
    if (ownerId) filter.ownerId = ownerId;
    const items = await this.vehicleModel
      .find(withNotDeleted(filter))
      .populate('ownerId', 'fullName email')
      .populate('assignedDriverId', 'fullName phone')
      .sort({ createdAt: -1 });
    return this.responseService.success('Vehicles fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.vehicleModel
      .findOne(withNotDeleted({ _id: id }))
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
    const previous = await this.vehicleModel.findById(id);
    if (!previous) {
      throw new NotFoundException('Vehicle not found');
    }

    const nextRegistration = dto.registrationNumber ?? dto.vehicleNumber;
    if (nextRegistration?.trim()) {
      const normalized = normalizeRegistrationNumber(nextRegistration);
      await this.assertRegistrationAvailable(
        previous.companyId.toString(),
        normalized,
        id,
      );
      dto.registrationNumber = normalized;
    }

    const nextDriverId =
      dto.assignedDriverId === null || dto.assignedDriverId === undefined
        ? dto.assignedDriverId
        : String(dto.assignedDriverId);
    if (nextDriverId) {
      await this.clearDriverFromOtherVehicles(nextDriverId, id);
    }

    const item = await this.vehicleModel.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
    });
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }

    if (
      dto.assignedDriverId &&
      dto.assignedDriverId !== previous?.assignedDriverId?.toString()
    ) {
      try {
        const driver = await this.driverModel
          .findById(dto.assignedDriverId)
          .select('fullName userId');
        const companyId = item.companyId?.toString();
        const recipientIds: string[] = [];
        if (driver?.userId) recipientIds.push(driver.userId.toString());
        if (item.ownerId) recipientIds.push(item.ownerId.toString());
        await this.notificationsService?.notify({
          userIds: recipientIds,
          companyId,
          type: NotificationType.DRIVER_ASSIGNMENT,
          title: 'Driver assigned',
          message: `${driver?.fullName ?? 'A driver'} was assigned to ${item.registrationNumber}.`,
          entityType: 'vehicle',
          entityId: item._id.toString(),
          meta: {
            driverId: dto.assignedDriverId,
            registrationNumber: item.registrationNumber,
          },
        });
      } catch (err) {
        this.logger.warn('Driver assignment notification failed', err);
      }
    }

    return this.responseService.success('Vehicle updated successfully', item);
  }

  async assignDriver(id: string, dto: AssignDriverDto, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerVehicle(id, ownerId);
    }
    await this.clearDriverFromOtherVehicles(dto.driverId, id);
    const item = await this.vehicleModel.findByIdAndUpdate(
      id,
      { assignedDriverId: dto.driverId },
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Vehicle not found');
    }

    try {
      const driver = await this.driverModel.findById(dto.driverId).select('fullName userId');
      const companyId = item.companyId?.toString();
      const recipientIds: string[] = [];
      if (driver?.userId) recipientIds.push(driver.userId.toString());
      if (item.ownerId) recipientIds.push(item.ownerId.toString());

      await this.notificationsService?.notify({
        userIds: recipientIds,
        companyId,
        type: NotificationType.DRIVER_ASSIGNMENT,
        title: 'Driver assigned',
        message: `${driver?.fullName ?? 'A driver'} was assigned to ${item.registrationNumber}.`,
        entityType: 'vehicle',
        entityId: item._id.toString(),
        meta: {
          driverId: dto.driverId,
          registrationNumber: item.registrationNumber,
        },
      });
    } catch (err) {
      this.logger.warn('Driver assignment notification failed', err);
    }

    return this.responseService.success('Driver assigned successfully', item);
  }

  async remove(id: string, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerVehicle(id, ownerId);
    }
    const existing = await this.vehicleModel.findOne(
      withNotDeleted({ _id: id }),
    );
    if (!existing) {
      throw new NotFoundException('Vehicle not found');
    }
    const item = await this.vehicleModel.findByIdAndUpdate(
      id,
      softDeleteUpdate({
        registrationNumber: tombstoneUniqueValue(
          existing.registrationNumber,
          id,
        ),
      }),
      { returnDocument: 'after' },
    );
    return this.responseService.success('Vehicle deleted successfully', item);
  }

  async restore(id: string) {
    const existing = await this.vehicleModel.findOne({
      _id: id,
      isDeleted: true,
    });
    if (!existing) {
      throw new NotFoundException('Deleted vehicle not found');
    }
    const item = await this.vehicleModel.findByIdAndUpdate(
      id,
      restoreUpdate({
        registrationNumber: restoreUniqueValue(
          existing.registrationNumber,
          id,
        ),
      }),
      { returnDocument: 'after' },
    );
    return this.responseService.success('Vehicle restored successfully', item);
  }
}
