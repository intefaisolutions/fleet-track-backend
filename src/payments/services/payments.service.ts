import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { UpdatePaymentDto } from '../dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly Model: Model<PaymentDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: CreatePaymentDto, companyId?: string) {
    const created = await this.Model.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('Payment created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.Model.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Payments fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.Model.findById(id);
    if (!item) {
      throw new NotFoundException('Payment not found');
    }
    return this.responseService.success('Payment fetched successfully', item);
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const item = await this.Model.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('Payment not found');
    }
    return this.responseService.success('Payment updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.Model.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Payment not found');
    }
    return this.responseService.success('Payment deleted successfully');
  }
}
