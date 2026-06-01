import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from '../platform/schemas/subscription-plan.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
