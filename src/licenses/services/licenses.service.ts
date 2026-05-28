import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { License, LicenseDocument } from '../schemas/license.schema';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';

@Injectable()
export class LicensesService {
  constructor(
    @InjectModel(License.name)
    private readonly Model: Model<LicenseDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: CreateLicenseDto, companyId?: string) {
    const created = await this.Model.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('License created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.Model.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Licenses fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.Model.findById(id);
    if (!item) {
      throw new NotFoundException('License not found');
    }
    return this.responseService.success('License fetched successfully', item);
  }

  async update(id: string, dto: UpdateLicenseDto) {
    const item = await this.Model.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('License not found');
    }
    return this.responseService.success('License updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.Model.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('License not found');
    }
    return this.responseService.success('License deleted successfully');
  }
}
