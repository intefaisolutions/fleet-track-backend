import { LicenseDocument } from '../schemas/license.schema';

export interface ILicenseService {
  findAll(companyId?: string): Promise<LicenseDocument[]>;
  findOne(id: string): Promise<LicenseDocument | null>;
}
