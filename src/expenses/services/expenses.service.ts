import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

  async create(dto: CreateExpenseDto, companyId?: string, recordedBy?: string) {
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

    const created = await this.expenseModel.create({
      companyId,
      vehicleId: dto.vehicleId,
      recordedBy,
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

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.expenseModel
      .find(filter)
      .populate('vehicleId', 'registrationNumber make modelName')
      .populate('recordedBy', 'fullName role')
      .sort({ expenseDate: -1 });
    return this.responseService.success('Expenses fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.expenseModel.findById(id);
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense fetched successfully', item);
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const item = await this.expenseModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.expenseModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Expense not found');
    }
    return this.responseService.success('Expense deleted successfully');
  }
}
