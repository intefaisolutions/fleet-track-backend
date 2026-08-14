import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from '../platform/schemas/subscription-plan.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SubscriptionsModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
