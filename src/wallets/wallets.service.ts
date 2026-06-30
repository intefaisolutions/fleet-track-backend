import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalletTransaction, WalletTransactionDocument } from './schemas/wallet-transaction.schema';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { ResponseService } from '../common/responses/response.service';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(WalletTransaction.name) private readonly transactionModel: Model<WalletTransactionDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    private readonly responseService: ResponseService,
  ) {}

  async getBalance(companyId: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new NotFoundException('Company not found');
    
    return this.responseService.success('Wallet balance fetched successfully', {
      walletBalance: company.walletBalance || 0
    });
  }

  async getTransactions(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const transactions = await this.transactionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('companyId', 'name email')
      .populate('referenceSubscriptionId', 'planType')
      .populate('paymentId', 'amount');
      
    return this.responseService.success('Wallet transactions fetched successfully', transactions);
  }
}
