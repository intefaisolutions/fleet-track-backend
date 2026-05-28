import { SettingDocument } from '../schemas/setting.schema';

export interface ISettingService {
  findAll(companyId?: string): Promise<SettingDocument[]>;
  findOne(id: string): Promise<SettingDocument | null>;
}
