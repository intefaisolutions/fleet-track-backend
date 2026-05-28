import { CompanyDocument } from '../schemas/company.schema';

export interface ICompanyService {
  findAll(companyId?: string): Promise<CompanyDocument[]>;
  findOne(id: string): Promise<CompanyDocument | null>;
}
