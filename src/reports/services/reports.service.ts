import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Driver.name) private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async getDashboard(companyId?: string) {
    const filter = companyId ? { companyId } : {};

    const [totalVehicles, activeDrivers, totalExpenses, expenseTotal] = await Promise.all([
      this.vehicleModel.countDocuments(filter),
      this.driverModel.countDocuments({ ...filter, isActive: true }),
      this.expenseModel.countDocuments(filter),
      this.expenseModel.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalExpenseAmount = expenseTotal[0]?.total ?? 0;

    return this.responseService.success('Dashboard report fetched', {
      totalVehicles,
      activeDrivers,
      totalExpenses,
      totalExpenseAmount,
    });
  }

  async getRevenue(companyId?: string) {
    const filter = companyId ? { companyId } : {};

    const byCategory = await this.expenseModel.aggregate([
      { $match: { ...filter, isActive: { $ne: false } } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const monthly = await this.expenseModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    const grandTotal = byCategory.reduce(
      (sum: number, row: { total: number }) => sum + row.total,
      0,
    );

    return this.responseService.success('Revenue report fetched', {
      grandTotal,
      byCategory,
      monthly,
    });
  }

  async exportExpensesCsv(companyId?: string): Promise<string> {
    const filter = companyId ? { companyId } : {};
    const expenses = await this.expenseModel
      .find(filter)
      .populate('vehicleId', 'registrationNumber')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'id,vehicleId,category,amount,description,createdAt';
    const rows = expenses.map((e) => {
      const vehicle =
        e.vehicleId && typeof e.vehicleId === 'object' && 'registrationNumber' in e.vehicleId
          ? (e.vehicleId as { registrationNumber: string }).registrationNumber
          : String(e.vehicleId);
      const desc = (e.description ?? '').replace(/"/g, '""');
      return [
        e._id,
        vehicle,
        e.category,
        e.amount,
        `"${desc}"`,
        (e as { createdAt?: Date }).createdAt?.toISOString() ?? '',
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

}
