import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { ExpensesController } from './controllers/expenses.controller';
import { ExpensesService } from './services/expenses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
