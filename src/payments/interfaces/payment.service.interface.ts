import { PaymentDocument } from '../schemas/payment.schema';

export interface IPaymentService {
  findAll(companyId?: string): Promise<PaymentDocument[]>;
  findOne(id: string): Promise<PaymentDocument | null>;
}
