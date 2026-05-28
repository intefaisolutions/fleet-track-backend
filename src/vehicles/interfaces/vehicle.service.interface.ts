import { VehicleDocument } from '../schemas/vehicle.schema';

export interface IVehicleService {
  findAll(companyId?: string): Promise<VehicleDocument[]>;
  findOne(id: string): Promise<VehicleDocument | null>;
}
