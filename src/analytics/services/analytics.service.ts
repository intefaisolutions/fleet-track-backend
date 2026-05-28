import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Driver.name) private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async getDashboard(companyId?: string) {
    const filter = companyId ? { companyId } : {};

    const [totalVehicles, activeDrivers, totalExpenses] = await Promise.all([
      this.vehicleModel.countDocuments(filter),
      this.driverModel.countDocuments({ ...filter, isActive: true }),
      this.expenseModel.countDocuments(filter),
    ]);

    return this.responseService.success('Dashboard analytics fetched', {
      totalVehicles,
      activeDrivers,
      totalExpenses,
    });
  }
}
