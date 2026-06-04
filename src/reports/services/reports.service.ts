import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole, VehicleStatus } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../../subscriptions/schemas/subscription.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Driver.name) private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async getDashboard(companyId?: string, ownerId?: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required for company dashboard');
    }

    const companyOid = new Types.ObjectId(companyId);
    const filter = { companyId: companyOid };
    const ownerOid = ownerId ? new Types.ObjectId(ownerId) : null;
    const ownerVehicleFilter = ownerOid ? { ...filter, ownerId: ownerOid } : filter;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ownedVehicles = ownerOid
      ? await this.vehicleModel
          .find(ownerVehicleFilter)
          .select('_id registrationNumber make modelName currentOdometerKm createdAt')
          .lean()
      : [];
    const ownedVehicleIds = ownedVehicles.map((v) => v._id);
    const expenseFilter = ownerOid
      ? { ...filter, vehicleId: { $in: ownedVehicleIds } }
      : filter;

    const [
      totalVehicles,
      totalOwners,
      totalDrivers,
      activeDrivers,
      vehiclesAddedThisMonth,
      expensesThisMonthAgg,
      maintenanceVehicles,
      subscription,
      company,
      recentExpenses,
      topOwnersAgg,
      totalExpenses,
      ownerRecentExpenses,
      ownerMostExpensiveAgg,
    ] = await Promise.all([
      this.vehicleModel.countDocuments(ownerVehicleFilter),
      ownerOid
        ? this.userModel.countDocuments({ _id: ownerOid, role: UserRole.VEHICLE_OWNER })
        : this.userModel.countDocuments({
            companyId: companyOid,
            role: UserRole.VEHICLE_OWNER,
          }),
      this.driverModel.countDocuments(filter),
      this.driverModel.countDocuments({ ...filter, isActive: true }),
      this.vehicleModel.countDocuments({
        ...ownerVehicleFilter,
        createdAt: { $gte: startOfMonth },
      }),
      this.expenseModel.aggregate([
        { $match: expenseFilter },
        {
          $addFields: {
            effectiveDate: { $ifNull: ['$expenseDate', '$createdAt'] },
          },
        },
        { $match: { effectiveDate: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      this.vehicleModel
        .find({
          ...ownerVehicleFilter,
          status: VehicleStatus.MAINTENANCE,
        })
        .sort({ updatedAt: -1 })
        .limit(3)
        .lean(),
      this.subscriptionModel.findOne({ companyId: companyOid }).lean(),
      this.companyModel.findById(companyId).lean(),
      this.expenseModel
        .find(expenseFilter)
        .populate('vehicleId', 'registrationNumber')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      ownerOid
        ? Promise.resolve([])
        : this.vehicleModel.aggregate([
            { $match: { companyId: companyOid, ownerId: { $exists: true, $ne: null } } },
            { $group: { _id: '$ownerId', fleetSize: { $sum: 1 } } },
            { $sort: { fleetSize: -1 } },
            { $limit: 5 },
          ]),
      this.expenseModel.countDocuments(expenseFilter),
      ownerOid
        ? this.expenseModel
            .find(expenseFilter)
            .populate('vehicleId', 'registrationNumber')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
        : Promise.resolve([]),
      ownerOid
        ? this.expenseModel.aggregate([
            { $match: expenseFilter },
            { $group: { _id: '$vehicleId', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: 'vehicles',
                localField: '_id',
                foreignField: '_id',
                as: 'vehicle',
              },
            },
            { $unwind: '$vehicle' },
          ])
        : Promise.resolve([]),
    ]);

    const expensesThisMonth = expensesThisMonthAgg[0]?.total ?? 0;
    const expensesCountThisMonth = expensesThisMonthAgg[0]?.count ?? 0;
    const driverEfficiency =
      totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) : 0;
    const vehicleGrowthPercent =
      totalVehicles > 0
        ? Math.round((vehiclesAddedThisMonth / totalVehicles) * 100)
        : 0;

    let topOwners: Array<{
      id: string;
      name: string;
      email: string;
      fleetSize: number;
      fleetPercent: number;
    }> = [];
    if (!ownerOid) {
      const ownerIds = topOwnersAgg.map((r) => r._id as Types.ObjectId);
      const owners = await this.userModel
        .find({ _id: { $in: ownerIds } })
        .select('fullName email')
        .lean();
      const ownerMap = new Map(owners.map((o) => [String(o._id), o]));
      const maxFleet = topOwnersAgg[0]?.fleetSize ?? 1;

      topOwners = topOwnersAgg.map((row) => {
        const owner = ownerMap.get(String(row._id));
        return {
          id: String(row._id),
          name: owner?.fullName ?? 'Unknown Owner',
          email: owner?.email ?? '',
          fleetSize: row.fleetSize as number,
          fleetPercent: Math.round(((row.fleetSize as number) / maxFleet) * 100),
        };
      });
    }

    const recentActivities = [
      ...maintenanceVehicles.map((v) => ({
        id: `maint-${v._id}`,
        type: 'maintenance' as const,
        message: `Vehicle ${v.registrationNumber} maintenance completed successfully.`,
        createdAt: (v as { updatedAt?: Date }).updatedAt ?? new Date(),
        meta: 'Maintenance Hub',
      })),
      ...recentExpenses.map((e) => {
        const vehicle =
          e.vehicleId && typeof e.vehicleId === 'object' && 'registrationNumber' in e.vehicleId
            ? (e.vehicleId as { registrationNumber: string }).registrationNumber
            : 'fleet';
        return {
          id: `exp-${e._id}`,
          type: 'expense' as const,
          message: `${e.category} expense recorded for ${vehicle} (₹${e.amount}).`,
          createdAt: (e as { createdAt?: Date }).createdAt ?? new Date(),
          meta: 'Expense Log',
        };
      }),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        meta: a.meta,
        createdAt: a.createdAt.toISOString(),
      }));

    const planType = subscription?.planType ?? company?.planType ?? 'FREE';
    const planLabel = planType
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');

    const upcomingServices = ownerOid
      ? ownedVehicles
          .map((v) => {
            const odometer = v.currentOdometerKm ?? 0;
            const dueInKm = 10000 - (odometer % 10000 || 10000);
            return {
              id: String(v._id),
              registrationNumber: v.registrationNumber,
              label: `${v.registrationNumber} - ${v.make} ${v.modelName}`,
              dueInKm,
            };
          })
          .filter((v) => v.dueInKm <= 1500)
          .sort((a, b) => a.dueInKm - b.dueInKm)
          .slice(0, 3)
      : [];

    const mostExpensiveVehicle = ownerOid
      ? ownerMostExpensiveAgg[0]
        ? {
            registrationNumber:
              ownerMostExpensiveAgg[0].vehicle?.registrationNumber ?? 'Unknown',
            label: `${ownerMostExpensiveAgg[0].vehicle?.registrationNumber ?? 'Unknown'} (${
              ownerMostExpensiveAgg[0].vehicle?.make ?? 'Vehicle'
            } ${ownerMostExpensiveAgg[0].vehicle?.modelName ?? ''})`.trim(),
            amount: ownerMostExpensiveAgg[0].total ?? 0,
          }
        : null
      : null;

    const ownerRecentExpenseRows = ownerOid
      ? ownerRecentExpenses.map((e) => {
          const reg =
            e.vehicleId && typeof e.vehicleId === 'object' && 'registrationNumber' in e.vehicleId
              ? (e.vehicleId as { registrationNumber: string }).registrationNumber
              : 'Unknown';
          return {
            id: String(e._id),
            category: e.category,
            amount: e.amount,
            registrationNumber: reg,
            createdAt: (e as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
          };
        })
      : [];

    return this.responseService.success('Dashboard report fetched', {
      totalVehicles,
      totalOwners,
      totalDrivers,
      activeDrivers,
      expensesThisMonth,
      expensesCountThisMonth,
      driverEfficiency,
      vehicleGrowthPercent,
      subscription: {
        planType,
        planLabel,
        expiresAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
        status: subscription?.status ?? 'ACTIVE',
      },
      recentActivities,
      topOwners,
      totalExpenses,
      totalExpenseAmount: expensesThisMonth,
      myVehiclesLimit: subscription?.vehicleLimit ?? company?.vehicleLimit ?? 0,
      mostExpensiveVehicle,
      upcomingServices,
      recentOwnerExpenses: ownerRecentExpenseRows,
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
