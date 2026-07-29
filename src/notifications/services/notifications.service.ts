import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationType } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import {
  restoreUpdate,
  softDeleteUpdate,
  withNotDeleted,
} from '../../common/utils/soft-delete.util';

export interface NotifyInput {
  userId?: string;
  userIds?: string[];
  companyId?: string;
  title: string;
  message: string;
  type: NotificationType;
  meta?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly responseService: ResponseService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  /**
   * Create + dispatch (in-app socket + push-ready provider).
   * Prefer this from domain services over raw create().
   */
  async notify(input: NotifyInput) {
    const recipientIds = [
      ...(input.userId ? [input.userId] : []),
      ...(input.userIds ?? []),
    ].filter(Boolean);

    if (recipientIds.length === 0 && !input.companyId) {
      this.logger.warn(`notify skipped — no recipients for ${input.type}`);
      return [];
    }

    // Company-wide with no users: store one company-scoped row (admins see via companyId)
    if (recipientIds.length === 0 && input.companyId) {
      const doc = await this.createOne({
        ...input,
        userId: undefined,
      });
      return doc ? [doc] : [];
    }

    const created: NotificationDocument[] = [];
    for (const uid of [...new Set(recipientIds)]) {
      const doc = await this.createOne({ ...input, userId: uid });
      if (doc) created.push(doc);
    }
    return created;
  }

  private async createOne(
    input: NotifyInput & { userId?: string },
  ): Promise<NotificationDocument | null> {
    try {
      if (input.dedupeKey) {
        const existing = await this.notificationModel.findOne({
          dedupeKey: input.dedupeKey,
        });
        if (existing) return existing;
      }

      const created = await this.notificationModel.create({
        title: input.title,
        message: input.message,
        type: input.type,
        userId: input.userId
          ? new Types.ObjectId(input.userId)
          : undefined,
        companyId: input.companyId
          ? new Types.ObjectId(input.companyId)
          : undefined,
        meta: input.meta,
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
        isRead: false,
        isActive: true,
      });

      await this.dispatcher.dispatch(created);
      return created;
    } catch (err: unknown) {
      // Duplicate dedupeKey race
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000 &&
        input.dedupeKey
      ) {
        return this.notificationModel.findOne({ dedupeKey: input.dedupeKey });
      }
      this.logger.error(`Failed to create notification ${input.type}`, err);
      return null;
    }
  }

  async create(dto: CreateNotificationDto, companyId?: string) {
    const created = await this.notify({
      ...dto,
      companyId: dto.companyId ?? companyId,
      userId: dto.userId,
    });
    return this.responseService.created(
      'Notification created successfully',
      created[0] ?? null,
    );
  }

  async findForUser(
    user: { userId: string; companyId?: string; role?: string },
    opts?: { unreadOnly?: boolean; limit?: number },
  ) {
    const filter: Record<string, unknown> = withNotDeleted({
      isActive: true,
      $or: [
        { userId: new Types.ObjectId(user.userId) },
        ...(user.companyId
          ? [
              {
                companyId: new Types.ObjectId(user.companyId),
                userId: { $exists: false },
              },
              {
                companyId: new Types.ObjectId(user.companyId),
                userId: null,
              },
            ]
          : []),
      ],
    });
    if (opts?.unreadOnly) {
      filter.isRead = false;
    }

    const limit = Math.min(opts?.limit ?? 50, 100);
    const items = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return this.responseService.success(
      'Notifications fetched successfully',
      items,
    );
  }

  async unreadCount(user: {
    userId: string;
    companyId?: string;
  }) {
    const filter: Record<string, unknown> = withNotDeleted({
      isActive: true,
      isRead: false,
      $or: [
        { userId: new Types.ObjectId(user.userId) },
        ...(user.companyId
          ? [
              {
                companyId: new Types.ObjectId(user.companyId),
                userId: { $exists: false },
              },
              {
                companyId: new Types.ObjectId(user.companyId),
                userId: null,
              },
            ]
          : []),
      ],
    });
    const count = await this.notificationModel.countDocuments(filter);
    return this.responseService.success('Unread count', { count });
  }

  async markRead(id: string, userId: string) {
    const item = await this.notificationModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { userId: new Types.ObjectId(userId) },
          { userId: { $exists: false } },
          { userId: null },
        ],
      },
      { isRead: true, readAt: new Date() },
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success('Notification marked as read', item);
  }

  async markAllRead(user: { userId: string; companyId?: string }) {
    const filter: Record<string, unknown> = withNotDeleted({
      isActive: true,
      isRead: false,
      $or: [
        { userId: new Types.ObjectId(user.userId) },
        ...(user.companyId
          ? [
              {
                companyId: new Types.ObjectId(user.companyId),
                userId: { $exists: false },
              },
              {
                companyId: new Types.ObjectId(user.companyId),
                userId: null,
              },
            ]
          : []),
      ],
    });
    const result = await this.notificationModel.updateMany(filter, {
      isRead: true,
      readAt: new Date(),
    });
    return this.responseService.success('All notifications marked as read', {
      modified: result.modifiedCount,
    });
  }

  async findAll(companyId?: string) {
    const filter = withNotDeleted(
      companyId ? { companyId, isActive: true } : { isActive: true },
    );
    const items = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100);
    return this.responseService.success(
      'Notifications fetched successfully',
      items,
    );
  }

  async findOne(id: string) {
    const item = await this.notificationModel.findOne(
      withNotDeleted({ _id: id }),
    );
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success(
      'Notification fetched successfully',
      item,
    );
  }

  async update(id: string, dto: UpdateNotificationDto) {
    const item = await this.notificationModel.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
    });
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success(
      'Notification updated successfully',
      item,
    );
  }

  async remove(id: string) {
    const item = await this.notificationModel.findOneAndUpdate(
      withNotDeleted({ _id: id }),
      softDeleteUpdate(),
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success('Notification deleted successfully', item);
  }

  async restore(id: string) {
    const item = await this.notificationModel.findOneAndUpdate(
      { _id: id, isDeleted: true },
      restoreUpdate(),
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Deleted notification not found');
    }
    return this.responseService.success(
      'Notification restored successfully',
      item,
    );
  }
}
