import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
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
      { name: Company.name, schema: CompanySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [LicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
