import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletTransaction, WalletTransactionSchema } from './schemas/wallet-transaction.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import {
  SubscriptionHistory,
  SubscriptionHistorySchema,
} from '../subscriptions/schemas/subscription-history.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from '../platform/schemas/subscription-plan.schema';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionHistory.name, schema: SubscriptionHistorySchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
    ]),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
