import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import { AuthService } from '../../auth/services/auth.service';
import { LoginDto } from '../../auth/dto/login.dto';
import { ExpensesService } from '../../expenses/services/expenses.service';
import { DriversService } from '../../drivers/services/drivers.service';
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { ExpenseCategory } from '../../common/enums';
import type { AuthenticatedUser } from '../../types';
import { DriverAddExpenseDto } from '../dto/driver-add-expense.dto';
import { DriverRepairRequestDto } from '../dto/driver-repair-request.dto';
import { DriverDailyReportDto } from '../dto/driver-daily-report.dto';
import { DriverUpdateProfileDto } from '../dto/driver-update-profile.dto';
import { DriverServiceAlertDto } from '../dto/driver-service-alert.dto';
import { DriverMyExpensesQueryDto } from '../dto/driver-my-expenses-query.dto';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';

function buildInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDisplayDate(value?: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatOdometer(km?: number | null): string | null {
  if (km == null || Number.isNaN(km)) return null;
  return `${Math.round(km).toLocaleString('en-IN')} km`;
}

function idVariants(id: string): Array<string | Types.ObjectId> {
  if (!Types.ObjectId.isValid(id)) return [id];
  return [id, new Types.ObjectId(id)];
}

function parseExpenseFilters(query?: DriverMyExpensesQueryDto) {
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (query?.month) {
    const [year, month] = query.month.split('-').map(Number);
    fromDate = new Date(year, month - 1, 1);
    toDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    if (query?.fromDate) fromDate = new Date(query.fromDate);
    if (query?.toDate) {
      toDate = new Date(query.toDate);
      toDate.setHours(23, 59, 59, 999);
    }
  }

  return {
    category: query?.category,
    fromDate,
    toDate,
  };
}

function sumExpenseAmount(expenses: Array<{ amount?: unknown }>) {
  return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
}

function buildTodaySummary(
  expenses: Array<{ category?: string; amount?: unknown; expenseDate?: Date | string }>,
  todayStart: Date,
) {
  const todayItems = expenses.filter((exp) => {
    const d = new Date(exp.expenseDate as string);
    return d >= todayStart;
  });

  const breakdownMap = new Map<string, number>();
  for (const exp of todayItems) {
    const cat = String(exp.category ?? 'OTHER');
    breakdownMap.set(cat, (breakdownMap.get(cat) ?? 0) + (Number(exp.amount) || 0));
  }

  const breakdown = [...breakdownMap.entries()].map(([category, amount]) => ({
    category,
    amount,
    label: category.charAt(0) + category.slice(1).toLowerCase(),
  }));

  const parts = breakdown.map((b) => `${b.label} ₹${Math.round(b.amount).toLocaleString('en-IN')}`);
  const label =
    todayItems.length === 0
      ? 'No expenses recorded today'
      : `${todayItems.length} expense${todayItems.length > 1 ? 's' : ''}: ${parts.join(' + ')}`;

  return {
    count: todayItems.length,
    total: sumExpenseAmount(todayItems),
    breakdown,
    label,
  };
}

@Injectable()
export class DriverAppService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
    private readonly expensesService: ExpensesService,
    private readonly driversService: DriversService,
    private readonly responseService: ResponseService,
  ) {}

  private async findDriverForUser(user: AuthenticatedUser): Promise<DriverDocument> {
    if (!user.companyId) {
      throw new BadRequestException('Driver account is not linked to a company');
    }

    const { userId, companyId } = user;

    let driver = await this.driverModel.findOne({
      userId: { $in: idVariants(userId) },
      companyId: { $in: idVariants(companyId) },
      isActive: { $ne: false },
    });

    if (!driver) {
      driver = await this.driverModel.findOne({
        userId: { $in: idVariants(userId) },
        isActive: { $ne: false },
      });
    }

    if (!driver) {
      const dbUser = await this.userModel.findById(userId);
      if (dbUser?.phone) {
        driver = await this.driverModel.findOne({
          companyId: { $in: idVariants(companyId) },
          phone: dbUser.phone.trim(),
          isActive: { $ne: false },
        });
        if (driver && !driver.userId) {
          driver.userId = dbUser._id as Types.ObjectId;
          await driver.save();
        }
      }
    }

    if (!driver) {
      throw new NotFoundException(
        'Driver profile not found. Ask your company admin to add you from Driver Management.',
      );
    }

    return driver;
  }

  private async findAssignedVehicle(
    driver: DriverDocument,
    companyId: string,
  ): Promise<{ vehicle: VehicleDocument; owner: UserDocument | null }> {
    const driverIdMatches = [driver._id, driver._id.toString()];

    const vehicle = await this.vehicleModel
      .findOne({
        assignedDriverId: { $in: driverIdMatches },
        companyId,
        isActive: { $ne: false },
      })
      .populate('ownerId', 'fullName phone email');

    if (!vehicle) {
      throw new BadRequestException(
        'No vehicle assigned to you. Contact your fleet admin to assign a vehicle.',
      );
    }

    const owner = vehicle.ownerId as unknown as UserDocument | null;
    return { vehicle, owner };
  }

  private async resolveDriverContext(user: AuthenticatedUser) {
    const driver = await this.findDriverForUser(user);
    const { vehicle, owner } = await this.findAssignedVehicle(driver, user.companyId!);
    return { driver, vehicle, owner };
  }

  private mapDriverUser(
    user: {
      id: unknown;
      fullName?: string;
      email?: string;
      phone?: string;
      role?: string;
    },
    driver: DriverDocument,
    vehicle: VehicleDocument | null,
    owner: UserDocument | null,
  ) {
    const vehicleLabel = vehicle
      ? [vehicle.make, vehicle.modelName].filter(Boolean).join(' ').trim()
      : '';
    return {
      id: String(user.id),
      name: user.fullName ?? driver.fullName,
      fullName: user.fullName ?? driver.fullName,
      email: user.email,
      phone: user.phone ?? driver.phone,
      role: user.role ?? UserRole.DRIVER,
      initials: buildInitials(user.fullName ?? driver.fullName),
      designation: driver.licenseNumber
        ? `Driver · ${driver.licenseNumber}`
        : 'Fleet Driver',
      vehicleNo: vehicle?.registrationNumber ?? '',
      vehicle: vehicle?.registrationNumber ?? '',
      vehicleModel: vehicleLabel || vehicle?.modelName || '',
      owner: owner?.fullName ?? '—',
      ownerPhone: owner?.phone ?? '',
      driverId: driver._id.toString(),
      vehicleId: vehicle?._id?.toString() ?? '',
    };
  }

  private mapExpenseItem(expense: Record<string, unknown>) {
    const vehicle = expense.vehicleId as Record<string, unknown> | undefined;
    const reg =
      (vehicle?.registrationNumber as string) ||
      (typeof expense.vehicleId === 'string' ? expense.vehicleId : '');

    return {
      id: String(expense._id),
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      expenseDate: expense.expenseDate,
      odometerKm: expense.odometerKm,
      receiptUrl: expense.receiptUrl,
      categoryDetails: expense.categoryDetails,
      vehicle: reg,
      recordedBy: expense.recordedBy,
      driverId: expense.driverId,
      createdAt: expense.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const result = await this.authService.login(dto);
    const data = result.data as {
      accessToken: string;
      refreshToken: string;
      expiresIn: string;
      user: { id: unknown; role: string; fullName?: string; email?: string; phone?: string };
    };

    if (data.user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('This login is for driver accounts only');
    }

    const user = await this.userModel.findById(data.user.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.driversService.ensureProfileForUser(user);

    let driverUser = data.user;
    try {
      const driver = await this.findDriverForUser({
        userId: String(data.user.id),
        email: data.user.email ?? '',
        role: data.user.role,
        companyId: user.companyId?.toString(),
      });
      let vehicle: VehicleDocument | null = null;
      let owner: UserDocument | null = null;
      try {
        const assigned = await this.findAssignedVehicle(
          driver,
          user.companyId!.toString(),
        );
        vehicle = assigned.vehicle;
        owner = assigned.owner;
      } catch {
        // Login succeeds even when no vehicle is assigned yet.
      }
      driverUser = this.mapDriverUser(data.user, driver, vehicle, owner);
    } catch {
      driverUser = {
        ...data.user,
        name: data.user.fullName,
        initials: buildInitials(data.user.fullName ?? 'DR'),
        designation: 'Fleet Driver',
        vehicleNo: '',
        vehicle: '',
        vehicleModel: '',
        owner: '',
        ownerPhone: '',
      } as typeof driverUser & Record<string, string>;
    }

    return this.responseService.success('Login successful', {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      user: driverUser,
    });
  }

  async getDashboard(user: AuthenticatedUser) {
    const { driver, vehicle, owner } = await this.resolveDriverContext(user);
    const dbUser = await this.userModel.findById(user.userId);
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    const profile = this.mapDriverUser(
      {
        id: dbUser._id,
        fullName: dbUser.fullName,
        email: dbUser.email,
        phone: dbUser.phone,
        role: dbUser.role,
      },
      driver,
      vehicle,
      owner,
    );

    const expenses = await this.expensesService.findForAssignedDriver(
      driver._id.toString(),
      user.companyId!,
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayExpenses = sumExpenseAmount(
      expenses.filter((raw) => {
        const exp = raw as unknown as { expenseDate: Date };
        return new Date(exp.expenseDate) >= todayStart;
      }),
    );
    const monthExpenses = sumExpenseAmount(
      expenses.filter((raw) => {
        const exp = raw as unknown as { expenseDate: Date };
        return new Date(exp.expenseDate) >= monthStart;
      }),
    );

    const todaySummary = buildTodaySummary(
      expenses as unknown as Array<{ category?: string; amount?: unknown; expenseDate?: Date | string }>,
      todayStart,
    );

    const vehicleLabel = [vehicle.make, vehicle.modelName].filter(Boolean).join(' ').trim();

    const recentExpenses = expenses.slice(0, 5).map((e) =>
      this.mapExpenseItem(e as unknown as Record<string, unknown>),
    );

    return this.responseService.success('Dashboard fetched successfully', {
      profile,
      myVehicle: {
        label: `${vehicleLabel || vehicle.modelName} – ${vehicle.registrationNumber}`,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        modelName: vehicle.modelName,
      },
      vehicleDetails: {
        registrationNumber: vehicle.registrationNumber,
        model: vehicleLabel || vehicle.modelName,
        ownerName: owner?.fullName ?? '—',
        label: `${vehicleLabel || vehicle.modelName} | Owner: ${owner?.fullName ?? '—'}`,
      },
      vehicle: {
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        modelName: vehicle.modelName,
        ownerName: owner?.fullName ?? '—',
      },
      stats: {
        todayExpenses,
        monthExpenses,
        monthTotalLabel: `₹${Math.round(monthExpenses).toLocaleString('en-IN')} this month`,
        lastServiceDate: formatDisplayDate(vehicle.lastServiceDate),
        lastServiceLabel: vehicle.lastServiceDate
          ? `Last Service: ${formatDisplayDate(vehicle.lastServiceDate)}`
          : 'Last Service: —',
        odometerKm: vehicle.currentOdometerKm ?? null,
        odometerLabel: formatOdometer(vehicle.currentOdometerKm),
      },
      todaySummary,
      recentExpenses,
    });
  }

  async getMyVehicle(user: AuthenticatedUser) {
    const { vehicle, owner } = await this.resolveDriverContext(user);
    const vehicleLabel = [vehicle.make, vehicle.modelName].filter(Boolean).join(' ').trim();

    return this.responseService.success('Vehicle fetched successfully', {
      label: `${vehicleLabel || vehicle.modelName} – ${vehicle.registrationNumber}`,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      modelName: vehicle.modelName,
      ownerName: owner?.fullName ?? '—',
      lastServiceDate: formatDisplayDate(vehicle.lastServiceDate),
      odometerKm: vehicle.currentOdometerKm ?? null,
      odometerLabel: formatOdometer(vehicle.currentOdometerKm),
    });
  }

  async getOwnerDetails(user: AuthenticatedUser) {
    const { owner } = await this.resolveDriverContext(user);
    if (!owner) {
      throw new NotFoundException('Vehicle owner details not found');
    }

    return this.responseService.success('Owner details fetched successfully', {
      name: owner.fullName,
      phone: owner.phone ?? '',
      email: owner.email ?? '',
      label: `${owner.fullName} | ${owner.phone ?? '—'}`,
    });
  }

  async getMyExpenses(user: AuthenticatedUser, query?: DriverMyExpensesQueryDto) {
    const driver = await this.findDriverForUser(user);
    const filters = parseExpenseFilters(query);

    const allItems = await this.expensesService.findForAssignedDriver(
      driver._id.toString(),
      user.companyId!,
    );
    const filteredItems = await this.expensesService.findForAssignedDriver(
      driver._id.toString(),
      user.companyId!,
      filters,
    );

    const mapped = filteredItems.map((e) =>
      this.mapExpenseItem(e as unknown as Record<string, unknown>),
    );

    return this.responseService.success('Expenses fetched successfully', {
      items: mapped,
      summary: {
        totalCount: allItems.length,
        totalAmount: sumExpenseAmount(allItems as unknown as Array<{ amount?: unknown }>),
        filteredCount: filteredItems.length,
        filteredAmount: sumExpenseAmount(filteredItems as unknown as Array<{ amount?: unknown }>),
        totalLabel: `Total: ₹${Math.round(sumExpenseAmount(allItems as unknown as Array<{ amount?: unknown }>)).toLocaleString('en-IN')}`,
      },
    });
  }

  async addExpense(user: AuthenticatedUser, dto: DriverAddExpenseDto) {
    const { driver, vehicle } = await this.resolveDriverContext(user);

    if (dto.odometerKm != null) {
      await this.vehicleModel.findByIdAndUpdate(vehicle._id, {
        currentOdometerKm: dto.odometerKm,
      });
    }

    const created = await this.expensesService.create(
      {
        vehicleId: vehicle._id.toString(),
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        odometerKm: dto.odometerKm,
        receiptUrl: dto.receiptUrl,
        categoryDetails: dto.categoryDetails,
      },
      user.companyId,
      user.userId,
      undefined,
      driver._id.toString(),
    );

    return created;
  }

  async serviceAlert(user: AuthenticatedUser, dto: DriverServiceAlertDto) {
    const { driver, vehicle } = await this.resolveDriverContext(user);

    return this.expensesService.create(
      {
        vehicleId: vehicle._id.toString(),
        category: ExpenseCategory.SERVICE,
        amount: 0,
        description: dto.message.trim(),
        expenseDate: new Date(),
        categoryDetails: {
          type: 'SERVICE_ALERT',
          message: dto.message.trim(),
          notes: dto.notes?.trim(),
        },
      },
      user.companyId,
      user.userId,
      undefined,
      driver._id.toString(),
    );
  }

  async repairRequest(user: AuthenticatedUser, dto: DriverRepairRequestDto) {
    const { driver, vehicle } = await this.resolveDriverContext(user);

    return this.expensesService.create(
      {
        vehicleId: vehicle._id.toString(),
        category: ExpenseCategory.REPAIR,
        amount: 0,
        description: dto.title,
        expenseDate: new Date(),
        receiptUrl: dto.receiptUrl,
        categoryDetails: {
          type: 'REPAIR_REQUEST',
          title: dto.title,
          description: dto.description,
        },
      },
      user.companyId,
      user.userId,
      undefined,
      driver._id.toString(),
    );
  }

  async dailyReport(user: AuthenticatedUser, dto: DriverDailyReportDto) {
    const { driver, vehicle } = await this.resolveDriverContext(user);
    const reportDate = dto.reportDate ? new Date(dto.reportDate) : new Date();

    return this.expensesService.create(
      {
        vehicleId: vehicle._id.toString(),
        category: ExpenseCategory.OTHER,
        amount: dto.totalExpense,
        description: dto.notes?.trim() || `Daily report: ${dto.destination}`,
        expenseDate: reportDate,
        categoryDetails: {
          type: 'DAILY_REPORT',
          totalKm: dto.totalKm,
          destination: dto.destination,
          notes: dto.notes,
          reportDate: dto.reportDate ?? reportDate.toISOString().slice(0, 10),
        },
      },
      user.companyId,
      user.userId,
      undefined,
      driver._id.toString(),
    );
  }

  async getProfile(user: AuthenticatedUser) {
    const dbUser = await this.userModel.findById(user.userId);
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    await this.driversService.ensureProfileForUser(dbUser);

    const driver = await this.findDriverForUser(user);

    let vehicle: VehicleDocument | null = null;
    let owner: UserDocument | null = null;
    try {
      const assigned = await this.findAssignedVehicle(driver, user.companyId!);
      vehicle = assigned.vehicle;
      owner = assigned.owner;
    } catch {
      // Profile can load without an assigned vehicle.
    }

    return this.responseService.success(
      'Profile fetched successfully',
      this.mapDriverUser(
        {
          id: dbUser._id,
          fullName: dbUser.fullName,
          email: dbUser.email,
          phone: dbUser.phone,
          role: dbUser.role,
        },
        driver,
        vehicle,
        owner,
      ),
    );
  }

  async updateProfile(user: AuthenticatedUser, dto: DriverUpdateProfileDto) {
    const { driver } = await this.resolveDriverContext(user);
    const fullName = dto.fullName.trim();

    await Promise.all([
      this.userModel.findByIdAndUpdate(user.userId, { fullName }),
      this.driverModel.findByIdAndUpdate(driver._id, { fullName }),
    ]);

    return this.getProfile(user);
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  async logout(user: AuthenticatedUser) {
    return this.authService.logout(user.userId);
  }
}
