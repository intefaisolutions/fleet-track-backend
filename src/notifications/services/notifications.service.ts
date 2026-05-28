import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationDto } from '../dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly Model: Model<NotificationDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: CreateNotificationDto, companyId?: string) {
    const created = await this.Model.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('Notification created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.Model.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Notifications fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.Model.findById(id);
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success('Notification fetched successfully', item);
  }

  async update(id: string, dto: UpdateNotificationDto) {
    const item = await this.Model.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success('Notification updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.Model.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return this.responseService.success('Notification deleted successfully');
  }
}
