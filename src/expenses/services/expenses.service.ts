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

  private async ownedVehicleIds(companyId: string, ownerId: string): Promise<Types.ObjectId[]> {
    return this.vehicleModel
      .find({ companyId, ownerId })
      .distinct('_id');
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
      companyId: new Types.ObjectId(companyId),
      vehicleId: new Types.ObjectId(dto.vehicleId),
      recordedBy: recordedBy ? new Types.ObjectId(recordedBy) : undefined,
      driverId: driverId ? new Types.ObjectId(driverId) : undefined,
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
      filter.companyId = companyId;
    }

    if (ownerId && companyId) {
      const ownedVehicleIds = await this.ownedVehicleIds(companyId, ownerId);
      if (ownedVehicleIds.length === 0) {
        return this.responseService.success('Expenses fetched successfully', []);
      }
      const idMatches = ownedVehicleIds.flatMap((id) => [id, id.toString()]);
      filter.vehicleId = { $in: idMatches };
    }

    const items = await this.expenseModel
      .find(filter)
      .populate({
        path: 'vehicleId',
        select: 'registrationNumber make modelName ownerId',
        populate: { path: 'ownerId', select: 'fullName email' },
      })
      .populate('recordedBy', 'fullName role')
      .sort({ expenseDate: -1 });
    return this.responseService.success('Expenses fetched successfully', items);
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
      companyId,
      driverId: { $in: [driverId, new Types.ObjectId(driverId)] },
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
