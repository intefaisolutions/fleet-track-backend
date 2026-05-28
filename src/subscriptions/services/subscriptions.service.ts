import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly Model: Model<SubscriptionDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: CreateSubscriptionDto, companyId?: string) {
    const created = await this.Model.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('Subscription created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.Model.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Subscriptions fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.Model.findById(id);
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription fetched successfully', item);
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const item = await this.Model.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.Model.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription deleted successfully');
  }
}
