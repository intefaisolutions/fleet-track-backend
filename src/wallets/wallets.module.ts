import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletTransaction, WalletTransactionSchema } from './schemas/wallet-transaction.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
