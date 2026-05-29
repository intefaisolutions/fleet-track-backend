import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { License, LicenseSchema } from '../licenses/schemas/license.schema';
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
    ]),
  ],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
