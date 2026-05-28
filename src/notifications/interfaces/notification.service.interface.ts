import { NotificationDocument } from '../schemas/notification.schema';

export interface INotificationService {
  findAll(companyId?: string): Promise<NotificationDocument[]>;
  findOne(id: string): Promise<NotificationDocument | null>;
}
