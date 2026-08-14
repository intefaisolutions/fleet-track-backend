import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from './schemas/wallet-transaction.schema';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../subscriptions/schemas/subscription.schema';
import {
  SubscriptionHistory,
  SubscriptionHistoryDocument,
} from '../subscriptions/schemas/subscription-history.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../platform/schemas/subscription-plan.schema';
import { ResponseService } from '../common/responses/response.service';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(WalletTransaction.name)
    private readonly transactionModel: Model<WalletTransactionDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionHistory.name)
    private readonly historyModel: Model<SubscriptionHistoryDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    private readonly responseService: ResponseService,
  ) {}

  private planLabel(planType?: string, displayName?: string) {
    return displayName || planType || '—';
  }

  async getBalance(companyId: string) {
    const company = await this.companyModel.findById(companyId).lean();
    if (!company) throw new NotFoundException('Company not found');

    const [subscription, latestHistory, planMeta] = await Promise.all([
      this.subscriptionModel.findOne({ companyId: company._id }).lean(),
      this.historyModel
        .findOne({ companyId: company._id })
        .sort({ createdAt: -1 })
        .lean(),
      this.planModel
        .findOne({ planType: company.planType })
        .select('planType displayName monthlyPriceInr')
        .lean(),
    ]);

    let lastChange: Record<string, unknown> | null = null;
    if (latestHistory) {
      const [oldPlan, newPlan] = await Promise.all([
        latestHistory.oldPlanId
          ? this.planModel.findById(latestHistory.oldPlanId).lean()
          : latestHistory.oldPlanType
            ? this.planModel.findOne({ planType: latestHistory.oldPlanType }).lean()
            : null,
        latestHistory.newPlanId
          ? this.planModel.findById(latestHistory.newPlanId).lean()
          : latestHistory.newPlanType
            ? this.planModel.findOne({ planType: latestHistory.newPlanType }).lean()
            : null,
      ]);

      const oldPlanType =
        latestHistory.oldPlanType || oldPlan?.planType || 'Previous plan';
      const newPlanType =
        latestHistory.newPlanType || newPlan?.planType || company.planType;
      const usedAmount =
        latestHistory.usedAmount ??
        Math.max(
          0,
          Number(latestHistory.oldPrice || 0) -
            Number(latestHistory.creditGenerated || 0),
        );
      const oldPriceNum = Number(latestHistory.oldPrice || 0);
      let usedDays = latestHistory.usedDays ?? 0;
      if (
        (latestHistory.usedDays == null || latestHistory.usedDays === 0) &&
        oldPriceNum > 0 &&
        usedAmount > 0
      ) {
        // Legacy history without usedDays — approximate from value used (30-day month)
        usedDays = Math.max(
          1,
          Math.round((usedAmount / oldPriceNum) * 30),
        );
      }
      const remainingDays =
        latestHistory.remainingDays ??
        (oldPriceNum > 0
          ? Math.max(0, 30 - usedDays)
          : 0);
      const creditGenerated = Number(latestHistory.creditGenerated || 0);
      const action = String(latestHistory.action || '');

      const actionLabel =
        action === 'UPGRADED'
          ? 'Upgrade'
          : action === 'DOWNGRADED'
            ? 'Downgrade'
            : action === 'RENEWED'
              ? 'Renewal'
              : 'Plan change';
      const actionPast =
        action === 'UPGRADED'
          ? 'upgraded'
          : action === 'DOWNGRADED'
            ? 'downgraded'
            : action === 'RENEWED'
              ? 'renewed'
              : 'changed';

      const summary =
        usedDays > 0
          ? `You used ${this.planLabel(oldPlanType, oldPlan?.displayName)} for ${usedDays} day${usedDays === 1 ? '' : 's'} (₹${usedAmount.toLocaleString('en-IN')} of the plan value). Unused amount ₹${creditGenerated.toLocaleString('en-IN')} went to your wallet, then you ${actionPast} to ${this.planLabel(newPlanType, newPlan?.displayName)}.`
          : `You changed from ${this.planLabel(oldPlanType, oldPlan?.displayName)} to ${this.planLabel(newPlanType, newPlan?.displayName)} (${actionLabel}). Unused credit ₹${creditGenerated.toLocaleString('en-IN')} was added to your wallet.`;

      lastChange = {
        action,
        actionLabel,
        fromPlan: oldPlanType,
        fromPlanName: this.planLabel(oldPlanType, oldPlan?.displayName),
        toPlan: newPlanType,
        toPlanName: this.planLabel(newPlanType, newPlan?.displayName),
        oldPrice: latestHistory.oldPrice ?? 0,
        newPrice: latestHistory.newPrice ?? 0,
        usedDays,
        usedAmount,
        remainingDays,
        creditGenerated,
        walletUsed: latestHistory.walletUsed ?? 0,
        changedAt: (latestHistory as { createdAt?: Date }).createdAt,
        summary,
      };
    }

    return this.responseService.success('Wallet balance fetched successfully', {
      walletBalance: company.walletBalance || 0,
      currentPlan: {
        planType: company.planType,
        displayName: this.planLabel(company.planType, planMeta?.displayName),
        vehicleLimit: company.vehicleLimit,
        status: subscription?.status ?? 'ACTIVE',
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        billingPeriod: subscription?.billingPeriod ?? null,
      },
      lastChange,
    });
  }

  async getTransactions(companyId?: string) {
    const filter: Record<string, unknown> = {};
    if (companyId) {
      filter.companyId = new Types.ObjectId(companyId);
    }

    const transactions = await this.transactionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('companyId', 'name email')
      .populate('referenceSubscriptionId', 'planType')
      .populate('paymentId', 'amount')
      .lean();

    const enriched = transactions.map((tx) => {
      const usedDays = tx.usedDays;
      const usedAmount = tx.usedAmount;
      let friendlyExplanation = tx.description || tx.reason || '';

      if (
        tx.type === 'CREDIT' &&
        usedDays != null &&
        tx.fromPlan &&
        usedAmount != null
      ) {
        friendlyExplanation = `You used ${tx.fromPlan} for ${usedDays} day${usedDays === 1 ? '' : 's'}, so ₹${Number(usedAmount).toLocaleString('en-IN')} was counted as used. Unused ₹${Number(tx.amount).toLocaleString('en-IN')} credited to wallet${tx.toPlan ? ` before moving to ${tx.toPlan}` : ''}.`;
      } else if (tx.type === 'DEBIT' && tx.fromPlan && tx.toPlan) {
        const verb =
          tx.changeAction === 'DOWNGRADED'
            ? 'Downgraded'
            : tx.changeAction === 'UPGRADED'
              ? 'Upgraded'
              : 'Changed';
        friendlyExplanation = `${verb} ${tx.fromPlan} → ${tx.toPlan}. Wallet paid ₹${Number(tx.amount).toLocaleString('en-IN')}.`;
      }

      return {
        ...tx,
        friendlyExplanation,
      };
    });

    return this.responseService.success(
      'Wallet transactions fetched successfully',
      enriched,
    );
  }
}
