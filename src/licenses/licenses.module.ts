import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { License, LicenseSchema } from './schemas/license.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from '../platform/schemas/subscription-plan.schema';
import { LicensesController } from './controllers/licenses.controller';
import { LicensesService } from './services/licenses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: License.name, schema: LicenseSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
    ]),
  ],
  controllers: [LicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
