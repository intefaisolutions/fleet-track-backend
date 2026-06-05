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
import { Driver, DriverDocument } from '../../drivers/schemas/driver.schema';
import { Vehicle, VehicleDocument } from '../../vehicles/schemas/vehicle.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { ExpenseCategory } from '../../common/enums';
import type { AuthenticatedUser } from '../../types';
import { DriverAddExpenseDto } from '../dto/driver-add-expense.dto';
import { DriverRepairRequestDto } from '../dto/driver-repair-request.dto';
import { DriverDailyReportDto } from '../dto/driver-daily-report.dto';
import { DriverUpdateProfileDto } from '../dto/driver-update-profile.dto';

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
    private readonly responseService: ResponseService,
  ) {}

  private async resolveDriverContext(user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('Driver account is not linked to a company');
    }

    const driver = await this.driverModel.findOne({
      userId: new Types.ObjectId(user.userId),
      companyId: new Types.ObjectId(user.companyId),
      isActive: true,
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const vehicle = await this.vehicleModel
      .findOne({
        assignedDriverId: driver._id,
        companyId: new Types.ObjectId(user.companyId),
        isActive: true,
      })
      .populate('ownerId', 'fullName phone email');

    if (!vehicle) {
      throw new BadRequestException(
        'No vehicle assigned to you. Contact your fleet admin to assign a vehicle.',
      );
    }

    const owner = vehicle.ownerId as unknown as UserDocument | null;

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
    vehicle: VehicleDocument,
    owner: UserDocument | null,
  ) {
    const vehicleLabel = [vehicle.make, vehicle.modelName].filter(Boolean).join(' ').trim();
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
      vehicleNo: vehicle.registrationNumber,
      vehicle: vehicle.registrationNumber,
      vehicleModel: vehicleLabel || vehicle.modelName,
      owner: owner?.fullName ?? '—',
      ownerPhone: owner?.phone ?? '',
      driverId: driver._id.toString(),
      vehicleId: vehicle._id.toString(),
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

    let driverUser = data.user;
    try {
      const { driver, vehicle, owner } = await this.resolveDriverContext({
        userId: String(data.user.id),
        email: data.user.email ?? '',
        role: data.user.role,
        companyId: user.companyId?.toString(),
      });
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

    const expenses = await this.expensesService.findByDriver(
      driver._id.toString(),
      user.companyId!,
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayExpenses = 0;
    let monthExpenses = 0;

    for (const raw of expenses) {
      const exp = raw as unknown as { amount: number; expenseDate: Date };
      const amt = Number(exp.amount) || 0;
      const d = new Date(exp.expenseDate);
      if (d >= todayStart) todayExpenses += amt;
      if (d >= monthStart) monthExpenses += amt;
    }

    const recentExpenses = expenses.slice(0, 5).map((e) =>
      this.mapExpenseItem(e as unknown as Record<string, unknown>),
    );

    return this.responseService.success('Dashboard fetched successfully', {
      profile,
      vehicle: {
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        modelName: vehicle.modelName,
        ownerName: owner?.fullName ?? '—',
      },
      stats: {
        todayExpenses,
        monthExpenses,
        lastServiceDate: formatDisplayDate(vehicle.lastServiceDate),
        odometerKm: vehicle.currentOdometerKm ?? null,
        odometerLabel: formatOdometer(vehicle.currentOdometerKm),
      },
      recentExpenses,
    });
  }

  async getMyExpenses(user: AuthenticatedUser) {
    const { driver } = await this.resolveDriverContext(user);
    const items = await this.expensesService.findByDriver(
      driver._id.toString(),
      user.companyId!,
    );
    return this.responseService.success(
      'Expenses fetched successfully',
      items.map((e) => this.mapExpenseItem(e as unknown as Record<string, unknown>)),
    );
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
    const { driver, vehicle, owner } = await this.resolveDriverContext(user);
    const dbUser = await this.userModel.findById(user.userId);
    if (!dbUser) {
      throw new NotFoundException('User not found');
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
}
