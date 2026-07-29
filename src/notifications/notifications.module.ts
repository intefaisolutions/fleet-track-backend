import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { License, LicenseSchema } from '../licenses/schemas/license.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { ExpiryNotificationsService } from './services/expiry-notifications.service';
import { NoopPushNotificationProvider } from './providers/noop-push.provider';
import { PUSH_NOTIFICATION_PROVIDER } from './providers/push-notification.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: License.name, schema: LicenseSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    ExpiryNotificationsService,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: NoopPushNotificationProvider,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
