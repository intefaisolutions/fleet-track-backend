import { DriverDocument } from '../schemas/driver.schema';

export interface IDriverService {
  findAll(companyId?: string): Promise<DriverDocument[]>;
  findOne(id: string): Promise<DriverDocument | null>;
}
