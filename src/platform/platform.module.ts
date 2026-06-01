import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { License, LicenseSchema } from '../licenses/schemas/license.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import { PlatformController } from './controllers/platform.controller';
import { PlatformService } from './services/platform.service';
import {
  PlatformSettings,
  PlatformSettingsSchema,
} from './schemas/platform-settings.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from './schemas/subscription-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: PlatformSettings.name, schema: PlatformSettingsSchema },
      { name: License.name, schema: LicenseSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
