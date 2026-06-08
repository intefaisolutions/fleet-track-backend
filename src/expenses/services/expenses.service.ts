import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    private readonly responseService: ResponseService,
  ) {}

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
      .find({
        companyId,
        ownerId: { $in: this.idVariants(ownerId) },
        isActive: { $ne: false },
      })
      .distinct('_id');
    return ids.flatMap((id) => this.idVariants(id));
  }

  private async assignedVehicleIds(
    driverId: string,
    companyId: string,
  ): Promise<Array<string | Types.ObjectId>> {
    const vehicles = await this.vehicleModel
      .find({
        companyId,
        assignedDriverId: { $in: this.idVariants(driverId) },
        isActive: { $ne: false },
      })
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

    const created = await this.expenseModel.create({
      companyId,
      vehicleId: dto.vehicleId,
      recordedBy: recordedBy ?? undefined,
      driverId: driverId ?? undefined,
      category: dto.category,
      amount: dto.amount,
      description: dto.description,
      expenseDate: dto.expenseDate ?? new Date(),
      odometerKm: dto.odometerKm,
      receiptUrl: dto.receiptUrl,
      categoryDetails: dto.categoryDetails,
    });

    return this.responseService.created('Expense created successfully', created);
  }

  async findAll(companyId?: string, ownerId?: string, allowAllCompanies = false) {
    if (!companyId && !ownerId && !allowAllCompanies) {
      throw new BadRequestException('companyId is required to list expenses');
    }

    const filter: Record<string, unknown> = {
      isActive: { $ne: false },
    };
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
    return this.responseService.success('Expenses fetched successfully', items);
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

    const filter: Record<string, unknown> = {
      companyId: { $in: this.idVariants(companyId) },
      vehicleId: { $in: vehicleIds },
      isActive: { $ne: false },
    };

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
    const filter: Record<string, unknown> = {
      companyId: { $in: this.idVariants(companyId) },
      driverId: { $in: this.idVariants(driverId) },
      isActive: { $ne: false },
    };

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
    const item = await this.expenseModel.findById(id);
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense fetched successfully', item);
  }

  async updateForDriver(
    expenseId: string,
    driverId: string,
    companyId: string,
    dto: { amount?: number; description?: string; expenseDate?: string },
  ) {
    const expense = await this.expenseModel.findOne({
      _id: expenseId,
      companyId: { $in: this.idVariants(companyId) },
      driverId: { $in: this.idVariants(driverId) },
      isActive: { $ne: false },
    });

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
      .findByIdAndUpdate(expenseId, update, { new: true })
      .populate('vehicleId', 'registrationNumber make modelName')
      .populate('recordedBy', 'fullName role');

    return this.responseService.success('Expense updated successfully', item);
  }

  async update(id: string, dto: UpdateExpenseDto, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerExpense(id, ownerId);
      if (dto.vehicleId) {
        await this.assertOwnerVehicle(dto.vehicleId, ownerId);
      }
    }
    const item = await this.expenseModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense updated successfully', item);
  }

  async remove(id: string, ownerId?: string) {
    if (ownerId) {
      await this.assertOwnerExpense(id, ownerId);
    }
    const item = await this.expenseModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense deleted successfully');
  }
}
