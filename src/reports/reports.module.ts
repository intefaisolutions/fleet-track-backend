import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { Driver, DriverSchema } from '../drivers/schemas/driver.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../subscriptions/schemas/subscription.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
