import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Setting, SettingDocument } from '../schemas/setting.schema';
import { CreateSettingDto } from '../dto/create-setting.dto';
import { UpdateSettingDto } from '../dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name)
    private readonly Model: Model<SettingDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: CreateSettingDto, companyId?: string) {
    const created = await this.Model.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('Setting created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.Model.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Settings fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.Model.findById(id);
    if (!item) {
      throw new NotFoundException('Setting not found');
    }
    return this.responseService.success('Setting fetched successfully', item);
  }

  async update(id: string, dto: UpdateSettingDto) {
    const item = await this.Model.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('Setting not found');
    }
    return this.responseService.success('Setting updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.Model.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Setting not found');
    }
    return this.responseService.success('Setting deleted successfully');
  }
}
