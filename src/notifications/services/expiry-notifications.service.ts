import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationType,
  UserRole,
  UserStatus,
  LicenseKeyStatus,
} from '../../common/enums';
import { withNotDeleted } from '../../common/utils/soft-delete.util';
import {
  License,
  LicenseDocument,
} from '../../licenses/schemas/license.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  Vehicle,
  VehicleDocument,
} from '../../vehicles/schemas/vehicle.schema';
import { NotificationsService } from './notifications.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Warn when expiry is within this many days */
const EXPIRY_WARN_DAYS = 30;
/** How often to scan (24h) */
const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ExpiryNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExpiryNotificationsService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    // Initial delay then daily scan
    setTimeout(() => void this.runScan(), 15_000);
    this.timer = setInterval(() => void this.runScan(), SCAN_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runScan() {
    this.logger.log('Running expiry notification scan…');
    try {
      await this.scanVehicleExpiries();
      await this.scanLicenseExpiries();
    } catch (err) {
      this.logger.error('Expiry scan failed', err);
    }
  }

  private async companyAdminIds(companyId: string): Promise<string[]> {
    const admins = await this.userModel
      .find(
        withNotDeleted({
          companyId,
          role: UserRole.COMPANY_ADMIN,
          status: UserStatus.ACTIVE,
        }),
      )
      .select('_id')
      .lean();
    return admins.map((a) => a._id.toString());
  }

  private async scanVehicleExpiries() {
    const now = new Date();
    const until = new Date(now.getTime() + EXPIRY_WARN_DAYS * DAY_MS);

    const vehicles = await this.vehicleModel
      .find(
        withNotDeleted({
          companyId: { $exists: true },
          $or: [
            { insuranceExpiry: { $gte: now, $lte: until } },
            { pucExpiry: { $gte: now, $lte: until } },
          ],
        }),
      )
      .select(
        'registrationNumber companyId insuranceExpiry pucExpiry ownerId',
      )
      .lean();

    for (const v of vehicles) {
      const companyId = v.companyId?.toString();
      if (!companyId) continue;
      const adminIds = await this.companyAdminIds(companyId);
      const recipientIds = [
        ...adminIds,
        ...(v.ownerId ? [v.ownerId.toString()] : []),
      ];

      if (v.insuranceExpiry && v.insuranceExpiry >= now && v.insuranceExpiry <= until) {
        const day = v.insuranceExpiry.toISOString().slice(0, 10);
        await this.notificationsService.notify({
          userIds: recipientIds,
          companyId,
          type: NotificationType.INSURANCE_EXPIRY,
          title: 'Insurance expiring soon',
          message: `Insurance for ${v.registrationNumber} expires on ${day}.`,
          entityType: 'vehicle',
          entityId: v._id.toString(),
          meta: { registrationNumber: v.registrationNumber, expiryDate: day },
          dedupeKey: `insurance:${v._id}:${day}`,
        });
      }

      if (v.pucExpiry && v.pucExpiry >= now && v.pucExpiry <= until) {
        const day = v.pucExpiry.toISOString().slice(0, 10);
        await this.notificationsService.notify({
          userIds: recipientIds,
          companyId,
          type: NotificationType.PUC_EXPIRY,
          title: 'PUC expiring soon',
          message: `PUC for ${v.registrationNumber} expires on ${day}.`,
          entityType: 'vehicle',
          entityId: v._id.toString(),
          meta: { registrationNumber: v.registrationNumber, expiryDate: day },
          dedupeKey: `puc:${v._id}:${day}`,
        });
      }
    }
  }

  private async scanLicenseExpiries() {
    const now = new Date();
    const until = new Date(now.getTime() + EXPIRY_WARN_DAYS * DAY_MS);

    const licenses = await this.licenseModel
      .find({
        status: {
          $in: [LicenseKeyStatus.ACTIVE, LicenseKeyStatus.UNUSED],
        },
        validUntil: { $gte: now, $lte: until },
        companyId: { $exists: true, $ne: null },
      })
      .select('licenseKey companyId validUntil planType')
      .lean();

    for (const lic of licenses) {
      const companyId = lic.companyId?.toString();
      if (!companyId) continue;
      const adminIds = await this.companyAdminIds(companyId);
      const day = lic.validUntil.toISOString().slice(0, 10);
      await this.notificationsService.notify({
        userIds: adminIds,
        companyId,
        type: NotificationType.LICENSE_EXPIRY,
        title: 'Company license expiring soon',
        message: `Your FleetTrack license (${lic.planType}) expires on ${day}.`,
        entityType: 'license',
        entityId: lic._id.toString(),
        meta: {
          licenseKey: lic.licenseKey,
          planType: lic.planType,
          expiryDate: day,
        },
        dedupeKey: `license:${lic._id}:${day}`,
      });
    }
  }
}
