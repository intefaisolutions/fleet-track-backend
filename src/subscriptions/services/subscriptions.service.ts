import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';
import { SubscriptionHistory, SubscriptionHistoryDocument, SubscriptionAction } from '../schemas/subscription-history.schema';
import { WalletTransaction, WalletTransactionDocument, TransactionType } from '../../wallets/schemas/wallet-transaction.schema';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { SubscriptionPlan, SubscriptionPlanDocument } from '../../platform/schemas/subscription-plan.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import {
  restoreUpdate,
  softDeleteUpdate,
  withNotDeleted,
} from '../../common/utils/soft-delete.util';
import { SubscriptionStatus, BillingPeriod } from '../../common/enums';
import {
  addBillingPeriod,
  planPriceForPeriod,
} from '../../common/utils/billing-period.util';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionHistory.name) private readonly historyModel: Model<SubscriptionHistoryDocument>,
    @InjectModel(WalletTransaction.name) private readonly walletModel: Model<WalletTransactionDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(SubscriptionPlan.name) private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly responseService: ResponseService,
  ) {}

  private roundToTwo(num: number): number {
    return Math.round(num * 100) / 100;
  }

  private formatInr(amount: number): string {
    return `₹${this.roundToTwo(amount).toLocaleString('en-IN')}`;
  }

  async calculateProration(subscription: SubscriptionDocument) {
    if (!subscription.startDate || !subscription.currentPeriodEnd) {
      return { usedAmount: 0, remainingCredit: 0, elapsedDays: 0, totalDays: 0 };
    }

    const start = subscription.startDate.getTime();
    const end = subscription.currentPeriodEnd.getTime();
    const now = new Date().getTime();

    const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, Math.min(totalDays, (now - start) / (1000 * 60 * 60 * 24)));

    const dailyPrice = subscription.originalPrice / totalDays;
    const usedAmount = this.roundToTwo(dailyPrice * elapsedDays);
    const remainingCredit = Math.max(0, this.roundToTwo(subscription.originalPrice - usedAmount));

    return { usedAmount, remainingCredit, elapsedDays, totalDays };
  }

  async changePlan(
    companyId: string,
    newPlanId: string,
    paymentId?: string,
    billingPeriod: BillingPeriod = BillingPeriod.MONTHLY,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const company = await this.companyModel.findById(companyId).session(session);
      if (!company) throw new NotFoundException('Company not found');

      const currentSub = await this.subModel.findOne({ companyId }).session(session);
      if (!currentSub) throw new NotFoundException('Active subscription not found');

      const newPlan = await this.planModel.findById(newPlanId).session(session);
      if (!newPlan) throw new NotFoundException('New plan not found');

      // 1. Calculate Proration
      const { usedAmount, remainingCredit, elapsedDays, totalDays } =
        await this.calculateProration(currentSub);
      const usedDays = Math.floor(elapsedDays);
      const remainingDays = Math.max(0, Math.ceil(totalDays - elapsedDays));
      const oldPlanType = currentSub.planType;

      // 2. Add credit to wallet if there's remaining
      if (remainingCredit > 0) {
        const prevBalance = company.walletBalance;
        company.walletBalance = this.roundToTwo(company.walletBalance + remainingCredit);

        await this.walletModel.create(
          [
            {
              companyId: company._id,
              type: TransactionType.CREDIT,
              amount: remainingCredit,
              reason: 'Proration credit from plan change',
              description: `You used ${oldPlanType} for ${usedDays} day${usedDays === 1 ? '' : 's'} (${this.formatInr(usedAmount)} used). Unused value ${this.formatInr(remainingCredit)} credited to wallet.`,
              previousBalance: prevBalance,
              currentBalance: company.walletBalance,
              referenceSubscriptionId: currentSub._id,
              referencePlan: oldPlanType,
              usedDays,
              usedAmount,
              remainingDays,
              fromPlan: oldPlanType,
              toPlan: newPlan.planType,
              changeAction:
                planPriceForPeriod(newPlan, billingPeriod) >= (currentSub.originalPrice || 0)
                  ? 'UPGRADED'
                  : 'DOWNGRADED',
            },
          ],
          { session },
        );
      }

      // 3. Purchase new plan using wallet — price depends on billing period
      let newPrice = planPriceForPeriod(newPlan, billingPeriod);
      let walletUsed = 0;
      let paymentRequired = newPrice;

      if (company.walletBalance > 0) {
        if (company.walletBalance >= newPrice) {
          walletUsed = newPrice;
          paymentRequired = 0;
        } else {
          walletUsed = company.walletBalance;
          paymentRequired = this.roundToTwo(newPrice - walletUsed);
        }

        const prevBalance = company.walletBalance;
        company.walletBalance = this.roundToTwo(company.walletBalance - walletUsed);

        const changeVerb =
          newPrice > (currentSub.originalPrice || 0)
            ? 'Upgrade'
            : newPrice < (currentSub.originalPrice || 0)
              ? 'Downgrade'
              : 'Plan change';

        await this.walletModel.create(
          [
            {
              companyId: company._id,
              type: TransactionType.DEBIT,
              amount: walletUsed,
              reason: `Purchased ${newPlan.planType} plan (${billingPeriod})`,
              description: `${changeVerb}: ${oldPlanType} → ${newPlan.displayName || newPlan.planType}. Wallet paid ${this.formatInr(walletUsed)} toward ${billingPeriod.toLowerCase()} plan.`,
              previousBalance: prevBalance,
              currentBalance: company.walletBalance,
              referenceSubscriptionId: currentSub._id,
              referencePlan: newPlan.planType,
              fromPlan: oldPlanType,
              toPlan: newPlan.planType,
              changeAction:
                newPrice > (currentSub.originalPrice || 0)
                  ? 'UPGRADED'
                  : newPrice < (currentSub.originalPrice || 0)
                    ? 'DOWNGRADED'
                    : 'RENEWED',
              usedDays,
              usedAmount,
              remainingDays,
            },
          ],
          { session },
        );
      }

      // 4. Update Subscription — period starts on purchase/change date
      const oldPlanId = currentSub.planId;
      const oldPrice = currentSub.originalPrice;

      let calculatedAction = SubscriptionAction.UPGRADED;
      if (newPrice > oldPrice) {
        calculatedAction = SubscriptionAction.UPGRADED;
      } else if (newPrice < oldPrice) {
        calculatedAction = SubscriptionAction.DOWNGRADED;
      } else {
        calculatedAction = SubscriptionAction.RENEWED;
      }

      const now = new Date();
      const periodEnd = addBillingPeriod(now, billingPeriod);

      currentSub.planId = newPlan._id;
      currentSub.planType = newPlan.planType;
      currentSub.originalPrice = newPrice;
      currentSub.walletUsed = walletUsed;
      currentSub.amountPaid = paymentRequired;
      currentSub.billingPeriod = billingPeriod;
      currentSub.startDate = now;
      currentSub.currentPeriodEnd = periodEnd;
      currentSub.status = SubscriptionStatus.ACTIVE;
      
      await currentSub.save({ session });
      await company.save({ session });

      // 5. Save History
      await this.historyModel.create(
        [
          {
            companyId: company._id,
            subscriptionId: currentSub._id,
            action: calculatedAction,
            oldPlanId: oldPlanId,
            newPlanId: newPlan._id,
            oldPrice: oldPrice,
            newPrice: newPrice,
            creditGenerated: remainingCredit,
            walletUsed: walletUsed,
            paymentCollected: paymentRequired,
            usedDays,
            usedAmount,
            remainingDays,
            oldPlanType,
            newPlanType: newPlan.planType,
            startDate: now,
            endDate: periodEnd,
            notes: `Used ${usedDays} day(s) of previous plan (${this.formatInr(usedAmount)}). Unused credit ${this.formatInr(remainingCredit)}.`,
          },
        ],
        { session },
      );

      // 6. Tie payment record if provided
      if (paymentId && paymentRequired > 0) {
        await this.paymentModel.findByIdAndUpdate(paymentId, {
          subscriptionId: currentSub._id,
          walletUsed: walletUsed,
        }, { session });
      }

      await session.commitTransaction();
      return this.responseService.success('Subscription updated successfully', currentSub);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async create(dto: CreateSubscriptionDto, companyId?: string) {
    const created = await this.subModel.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('Subscription created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.subModel
      .find(withNotDeleted(filter))
      .sort({ createdAt: -1 });

    // Keep active subscription aligned with company.planType / vehicleLimit
    // (license registration is source of truth; stale FREE subs caused wrong UI).
    if (companyId) {
      const company = await this.companyModel.findById(companyId).lean();
      if (company?.planType) {
        const active =
          items.find((s) => s.status === SubscriptionStatus.ACTIVE) ??
          items.find((s) => s.status === SubscriptionStatus.TRIAL) ??
          items[0];
        if (
          active &&
          (active.planType !== company.planType ||
            (company.vehicleLimit != null &&
              active.vehicleLimit !== company.vehicleLimit))
        ) {
          active.planType = company.planType;
          if (company.vehicleLimit != null) {
            active.vehicleLimit = company.vehicleLimit;
          }
          await active.save();
        }
      }
    }

    return this.responseService.success('Subscriptions fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.subModel.findOne(withNotDeleted({ _id: id }));
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription fetched successfully', item);
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const item = await this.subModel.findOneAndUpdate(
      withNotDeleted({ _id: id }),
      dto,
      {
        returnDocument: 'after',
      },
    );
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.subModel.findOneAndUpdate(
      withNotDeleted({ _id: id }),
      softDeleteUpdate({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      }),
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription deleted successfully', item);
  }

  async restore(id: string) {
    const item = await this.subModel.findOneAndUpdate(
      { _id: id, isDeleted: true },
      restoreUpdate({ status: SubscriptionStatus.ACTIVE }),
      { returnDocument: 'after' },
    );
    if (!item) {
      throw new NotFoundException('Deleted subscription not found');
    }
    return this.responseService.success('Subscription restored successfully', item);
  }

  async previewPlanChange(
    companyId: string,
    newPlanId: string,
    billingPeriod: BillingPeriod = BillingPeriod.MONTHLY,
  ) {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new NotFoundException('Company not found');

    const currentSub = await this.subModel.findOne({ companyId });
    if (!currentSub) throw new NotFoundException('Active subscription not found');

    const newPlan = await this.planModel.findById(newPlanId);
    if (!newPlan) throw new NotFoundException('New plan not found');

    const { usedAmount, remainingCredit, elapsedDays, totalDays } = await this.calculateProration(currentSub);
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const newPrice = planPriceForPeriod(newPlan, billingPeriod);

    const walletBalanceBefore = company.walletBalance;
    const totalAvailable = this.roundToTwo(walletBalanceBefore + remainingCredit);

    let walletUsed = 0;
    let paymentRequiredAmt = newPrice;

    if (totalAvailable >= newPrice) {
      walletUsed = newPrice;
      paymentRequiredAmt = 0;
    } else {
      walletUsed = totalAvailable;
      paymentRequiredAmt = this.roundToTwo(newPrice - walletUsed);
    }

    const walletBalanceAfter = this.roundToTwo(totalAvailable - walletUsed);
    const periodStartsAt = new Date();
    const periodEndsAt = addBillingPeriod(periodStartsAt, billingPeriod);

    return this.responseService.success('Plan change preview', {
      currentPlan: currentSub.planId,
      newPlan: newPlan.planType,
      currentPrice: currentSub.originalPrice,
      newPrice: newPrice,
      billingPeriod,
      periodStartsAt: periodStartsAt.toISOString(),
      periodEndsAt: periodEndsAt.toISOString(),
      usedDays: Math.floor(elapsedDays),
      remainingDays: Math.ceil(remainingDays),
      creditGenerated: remainingCredit,
      walletBalanceBefore: walletBalanceBefore,
      walletUsed: walletUsed,
      walletBalanceAfter: walletBalanceAfter,
      amountToPay: paymentRequiredAmt,
      paymentRequired: paymentRequiredAmt > 0
    });
  }
}
