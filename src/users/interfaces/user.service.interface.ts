import { UserDocument } from '../schemas/user.schema';

export interface IUserService {
  findAll(companyId?: string): Promise<UserDocument[]>;
  findOne(id: string): Promise<UserDocument | null>;
}
