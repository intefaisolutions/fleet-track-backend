import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { Driver, DriverSchema } from '../drivers/schemas/driver.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DriverAppController } from './controllers/driver-app.controller';
import { DriverAppService } from './services/driver-app.service';

@Module({
  imports: [
    AuthModule,
    ExpensesModule,
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DriverAppController],
  providers: [DriverAppService],
})
export class DriverAppModule {}
