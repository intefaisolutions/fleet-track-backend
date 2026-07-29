import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationChannel,
  NotificationPushStatus,
} from '../../common/enums';
import { SocketService } from '../../socket/services/socket.service';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';
import {
  PUSH_NOTIFICATION_PROVIDER,
  PushNotificationProvider,
} from '../providers/push-notification.provider';

/**
 * Persisted notification → realtime socket + push provider (swap-ready).
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Optional() private readonly socketService?: SocketService,
    @Optional()
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider?: PushNotificationProvider,
  ) {}

  async dispatch(notification: NotificationDocument) {
    const payload = {
      id: notification._id.toString(),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      meta: notification.meta,
      entityType: notification.entityType,
      entityId: notification.entityId,
      companyId: notification.companyId?.toString(),
      userId: notification.userId?.toString(),
      createdAt: (notification as NotificationDocument & { createdAt?: Date })
        .createdAt,
    };

    const channels = notification.channels?.length
      ? notification.channels
      : [NotificationChannel.IN_APP, NotificationChannel.PUSH];

    if (channels.includes(NotificationChannel.IN_APP) && this.socketService) {
      try {
        if (notification.userId) {
          this.socketService.emitToUser(
            notification.userId.toString(),
            'notification:new',
            payload,
          );
        }
        if (notification.companyId) {
          this.socketService.emitNotification(
            notification.companyId.toString(),
            payload,
          );
        }
      } catch (err) {
        this.logger.warn('Socket emit failed', err);
      }
    }

    if (channels.includes(NotificationChannel.PUSH) && this.pushProvider) {
      try {
        const sent = await this.pushProvider.send({
          userId: notification.userId?.toString(),
          companyId: notification.companyId?.toString(),
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: {
            notificationId: notification._id.toString(),
            ...(notification.meta ?? {}),
          },
          notificationId: notification._id.toString(),
        });
        await this.notificationModel.findByIdAndUpdate(notification._id, {
          pushStatus: sent
            ? NotificationPushStatus.SENT
            : NotificationPushStatus.SKIPPED,
        });
      } catch (err) {
        this.logger.warn('Push dispatch failed', err);
        await this.notificationModel.findByIdAndUpdate(notification._id, {
          pushStatus: NotificationPushStatus.FAILED,
        });
      }
    } else {
      await this.notificationModel.findByIdAndUpdate(notification._id, {
        pushStatus: NotificationPushStatus.SKIPPED,
      });
    }
  }
}
