import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpenseCategory } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import { StorageService } from '../../storage/services/storage.service';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import {
  restoreUpdate,
  softDeleteUpdate,
  withNotDeleted,
} from '../../common/utils/soft-delete.util';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    private readonly responseService: ResponseService,
    private readonly storageService: StorageService,
  ) {}

  /** DB keeps private S3 URL; API responses get a signed/viewable URL. */
  private async presentExpense(item: unknown) {
    if (!item || typeof item !== 'object') return item;
    const plain =
      typeof (item as { toObject?: () => Record<string, unknown> }).toObject ===
      'function'
        ? (item as { toObject: () => Record<string, unknown> }).toObject()
        : { ...(item as Record<string, unknown>) };

    const receiptUrl =
      typeof plain.receiptUrl === 'string' ? plain.receiptUrl.trim() : '';
    if (receiptUrl) {
      plain.receiptUrl =
        (await this.storageService.toViewUrl(receiptUrl)) || receiptUrl;
    }
    return plain;
  }

  private async presentExpenses(items: unknown[]) {
    return Promise.all(items.map((item) => this.presentExpense(item)));
  }

  /**
   * When a paid SERVICE expense is recorded (not a driver Service Alert),
   * keep vehicle.lastServiceDate as the latest service date.
   */
  private isPaidServiceExpense(
    category: string,
    categoryDetails?: Record<string, unknown> | null,
  ): boolean {
    if (category !== ExpenseCategory.SERVICE) return false;
    const type = categoryDetails?.type;
    if (type === 'SERVICE_ALERT') return false;
    return true;
  }

  private async syncVehicleLastServiceDate(
    vehicleId: string | Types.ObjectId,
    expenseDate?: Date | string | null,
  ) {
    const serviceDate = expenseDate ? new Date(expenseDate) : new Date();
    if (Number.isNaN(serviceDate.getTime())) return;

    const vehicle = await this.vehicleModel.findById(vehicleId).select('lastServiceDate');
    if (!vehicle) return;

    const current = vehicle.lastServiceDate
      ? new Date(vehicle.lastServiceDate).getTime()
      : 0;
    if (serviceDate.getTime() < current) return;

    await this.vehicleModel.findByIdAndUpdate(vehicleId, {
      lastServiceDate: serviceDate,
    });
  }

  private async assertOwnerVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.ownerId?.toString() !== ownerId) {
      throw new ForbiddenException('You can only manage expenses for your own vehicles');
    }
    return vehicle;
  }

  private async assertOwnerExpense(expenseId: string, ownerId: string) {
    const expense = await this.expenseModel.findById(expenseId);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    await this.assertOwnerVehicle(expense.vehicleId.toString(), ownerId);
    return expense;
  }

  private idVariants(id: string | Types.ObjectId): Array<string | Types.ObjectId> {
    const str = id.toString();
    if (!Types.ObjectId.isValid(str)) return [str];
    return [str, new Types.ObjectId(str)];
  }

  private async ownedVehicleIds(
    companyId: string,
    ownerId: string,
  ): Promise<Array<string | Types.ObjectId>> {
    const ids = await this.vehicleModel
      .find(
        withNotDeleted({
          companyId,
          ownerId: { $in: this.idVariants(ownerId) },
          isActive: { $ne: false },
        }),
      )
      .distinct('_id');
    return ids.flatMap((id) => this.idVariants(id));
  }

  private async assignedVehicleIds(
    driverId: string,
    companyId: string,
  ): Promise<Array<string | Types.ObjectId>> {
    const vehicles = await this.vehicleModel
      .find(
        withNotDeleted({
          companyId,
          assignedDriverId: { $in: this.idVariants(driverId) },
          isActive: { $ne: false },
        }),
      )
      .select('_id')
      .lean();
    return vehicles.flatMap((v) => this.idVariants(v._id));
  }

  async create(
    dto: CreateExpenseDto,
    companyId?: string,
    recordedBy?: string,
    ownerId?: string,
    driverId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required to create an expense');
    }

    const vehicle = await this.vehicleModel.findById(dto.vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.companyId.toString() !== companyId) {
      throw new BadRequestException('Vehicle does not belong to your company');
    }
    if (ownerId && vehicle.ownerId?.toString() !== ownerId) {
      throw new ForbiddenException('You can only add expenses for your own vehicles');
    }

    const clientRequestId = dto.clientRequestId?.trim() || undefined;
    if (clientRequestId) {
      const existing = await this.expenseModel.findOne(
        withNotDeleted({ clientRequestId }),
      );
      if (existing) {
        return this.responseService.success(
          'Expense already synced (duplicate prevented)',
          existing,
        );
      }
    }

    try {
      const expenseDate = dto.expenseDate ?? new Date();
      const created = await this.expenseModel.create({
        companyId,
        vehicleId: dto.vehicleId,
        recordedBy: recordedBy ?? undefined,
        driverId: driverId ?? undefined,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        expenseDate,
        odometerKm: dto.odometerKm,
        receiptUrl: dto.receiptUrl,
        categoryDetails: dto.categoryDetails,
        clientRequestId,
      });

      if (
        this.isPaidServiceExpense(
          dto.category,
          dto.categoryDetails as Record<string, unknown> | undefined,
        )
      ) {
        await this.syncVehicleLastServiceDate(dto.vehicleId, expenseDate);
      }

      return this.responseService.created(
        'Expense created successfully',
        await this.presentExpense(created),
      );
    } catch (err: unknown) {
      // Race: another sync already inserted the same clientRequestId
      if (
        clientRequestId &&
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        const existing = await this.expenseModel.findOne(
          withNotDeleted({ clientRequestId }),
        );
        if (existing) {
          return this.responseService.success(
            'Expense already synced (duplicate prevented)',
            existing,
          );
        }
      }
      throw err;
    }
  }

  async findAll(companyId?: string, ownerId?: string, allowAllCompanies = false) {
    if (!companyId && !ownerId && !allowAllCompanies) {
      throw new BadRequestException('companyId is required to list expenses');
    }

    const filter: Record<string, unknown> = withNotDeleted({
      isActive: { $ne: false },
    });
    if (companyId) {
      filter.companyId = { $in: this.idVariants(companyId) };
    }

    if (ownerId && companyId) {
      const ownedVehicleIds = await this.ownedVehicleIds(companyId, ownerId);
      if (ownedVehicleIds.length === 0) {
        return this.responseService.success('Expenses fetched successfully', []);
      }
      filter.vehicleId = { $in: ownedVehicleIds };
    }

    const items = await this.expenseModel
      .find(filter)
      .populate({
        path: 'vehicleId',
        select: 'registrationNumber make modelName ownerId assignedDriverId',
        populate: { path: 'ownerId', select: 'fullName email' },
      })
      .populate('recordedBy', 'fullName role')
      .populate('driverId', 'fullName phone')
      .sort({ expenseDate: -1 });
    return this.responseService.success(
      'Expenses fetched successfully',
      await this.presentExpenses(items),
    );
  }

  /** Expenses on vehicles assigned to this driver (owner-added + driver-added). */
  async findForAssignedDriver(
    driverId: string,
    companyId: string,
    filters?: {
      category?: string;
      fromDate?: Date;
      toDate?: Date;
    },
  ) {
    const vehicleIds = await this.assignedVehicleIds(driverId, companyId);
    if (vehicleIds.length === 0) {
      return this.findByDriver(driverId, companyId, filters);
    }

    const filter: Record<string, unknown> = withNotDeleted({
      companyId: { $in: this.idVariants(companyId) },
      vehicleId: { $in: vehicleIds },
      isActive: { $ne: false },
    });

    if (filters?.category) {
      filter.category = filters.category;
    }

    if (filters?.fromDate || filters?.toDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.fromDate) dateFilter.$gte = filters.fromDate;
      if (filters.toDate) dateFilter.$lte = filters.toDate;
      filter.expenseDate = dateFilter;
    }

    return this.expenseModel
      .find(filter)
      .populate('vehicleId', 'registrationNumber make modelName')
      .populate('recordedBy', 'fullName role')
      .populate('driverId', 'fullName phone')
      .sort({ expenseDate: -1 })
      .lean();
  }

  async findByDriver(
    driverId: string,
    companyId: string,
    filters?: {
      category?: string;
      fromDate?: Date;
      toDate?: Date;
    },
  ) {
    const filter: Record<string, unknown> = withNotDeleted({
      companyId: { $in: this.idVariants(companyId) },
      driverId: { $in: this.idVariants(driverId) },
      isActive: { $ne: false },
    });

    if (filters?.category) {
      filter.category = filters.category;
    }

    if (filters?.fromDate || filters?.toDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.fromDate) dateFilter.$gte = filters.fromDate;
      if (filters.toDate) dateFilter.$lte = filters.toDate;
      filter.expenseDate = dateFilter;
    }

    return this.expenseModel
      .find(filter)
      .populate('vehicleId', 'registrationNumber make modelName')
      .sort({ expenseDate: -1 })
      .lean();
  }

  async findOne(id: string) {
    const item = await this.expenseModel.findOne(withNotDeleted({ _id: id }));
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success(
      'Expense fetched successfully',
      await this.presentExpense(item),
    );
  }

  async updateForDriver(
    expenseId: string,
    driverId: string,
    companyId: string,
    dto: { amount?: number; description?: string; expenseDate?: string },
  ) {
    const expense = await this.expenseModel.findOne(
      withNotDeleted({
        _id: expenseId,
        companyId: { $in: this.idVariants(companyId) },
        driverId: { $in: this.idVariants(driverId) },
        isActive: { $ne: false },
      }),
    );

    if (!expense) {
      throw new ForbiddenException('You can only edit expenses that you recorded');
    }

    const update: Record<string, unknown> = {};
    if (dto.amount !== undefined) update.amount = dto.amount;
    if (dto.description !== undefined) update.description = dto.description.trim();
    if (dto.expenseDate !== undefined) update.expenseDate = new Date(dto.expenseDate);

    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const item = await this.expenseModel
      .findByIdAndUpdate(expenseId, update, { returnDocument: 'after' })
      .populate('vehicleId', 'registrationNumber make modelName')
      .populate('recordedBy', 'fullName role');

    return this.responseService.success(
      'Expense updated successfully',
      await this.presentExpense(item),
    );
  }

  async update(id: string, dto: UpdateExpenseDto, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerExpense(id, ownerId);
      if (dto.vehicleId) {
        await this.assertOwnerVehicle(dto.vehicleId, ownerId);
      }
    }
    const item = await this.expenseModel.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
    });
    if (!item) {
      throw new NotFoundException('Expense not found');
    }

    const details =
      (item.categoryDetails as Record<string, unknown> | undefined) ?? undefined;
    if (this.isPaidServiceExpense(item.category, details)) {
      await this.syncVehicleLastServiceDate(
        item.vehicleId,
        item.expenseDate ?? new Date(),
      );
    }

    return this.responseService.success(
      'Expense updated successfully',
      await this.presentExpense(item),
    );
  }

  async remove(id: string, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerExpense(id, ownerId);
    }
    const item = await this.expenseModel.findOneAndUpdate(
      withNotDeleted({ _id: id }),
      softDeleteUpdate(),
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense deleted successfully', item);
  }

  async restore(id: string) {
    const item = await this.expenseModel.findOneAndUpdate(
      { _id: id, isDeleted: true },
      restoreUpdate(),
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Deleted expense not found');
    }
    return this.responseService.success('Expense restored successfully', item);
  }
}
