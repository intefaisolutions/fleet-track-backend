import { ReportDocument } from '../schemas/report.schema';

export interface IReportService {
  findAll(companyId?: string): Promise<ReportDocument[]>;
  findOne(id: string): Promise<ReportDocument | null>;
}
