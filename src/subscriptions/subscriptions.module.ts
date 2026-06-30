import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { SubscriptionHistory, SubscriptionHistorySchema } from './schemas/subscription-history.schema';
import { WalletTransaction, WalletTransactionSchema } from '../wallets/schemas/wallet-transaction.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { SubscriptionPlan, SubscriptionPlanSchema } from '../platform/schemas/subscription-plan.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionHistory.name, schema: SubscriptionHistorySchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Company.name, schema: CompanySchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
