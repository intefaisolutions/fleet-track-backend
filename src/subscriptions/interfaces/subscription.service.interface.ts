import { SubscriptionDocument } from '../schemas/subscription.schema';

export interface ISubscriptionService {
  findAll(companyId?: string): Promise<SubscriptionDocument[]>;
  findOne(id: string): Promise<SubscriptionDocument | null>;
}
