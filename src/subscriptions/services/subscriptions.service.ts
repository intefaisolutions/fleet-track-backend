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

  async changePlan(companyId: string, newPlanId: string, paymentId?: string, action: SubscriptionAction = SubscriptionAction.UPGRADED) {
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
      const { remainingCredit } = await this.calculateProration(currentSub);

      // 2. Add credit to wallet if there's remaining
      if (remainingCredit > 0) {
        const prevBalance = company.walletBalance;
        company.walletBalance = this.roundToTwo(company.walletBalance + remainingCredit);
        
        await this.walletModel.create([{
          companyId: company._id,
          type: TransactionType.CREDIT,
          amount: remainingCredit,
          reason: 'Proration credit from plan change',
          previousBalance: prevBalance,
          currentBalance: company.walletBalance,
          referenceSubscriptionId: currentSub._id,
        }], { session });
      }

      // 3. Purchase new plan using wallet
      let newPrice = newPlan.monthlyPriceInr; // Assuming monthly for this logic
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

        await this.walletModel.create([{
          companyId: company._id,
          type: TransactionType.DEBIT,
          amount: walletUsed,
          reason: `Purchased ${newPlan.planType} plan`,
          previousBalance: prevBalance,
          currentBalance: company.walletBalance,
          referenceSubscriptionId: currentSub._id,
        }], { session });
      }

      // 4. Update Subscription
      const oldPlanId = currentSub.planId;
      const oldPrice = currentSub.originalPrice;

      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1); // Exact date logic

      currentSub.planId = newPlan._id;
      currentSub.originalPrice = newPrice;
      currentSub.walletUsed = walletUsed;
      currentSub.amountPaid = paymentRequired;
      currentSub.startDate = now;
      currentSub.currentPeriodEnd = nextMonth;
      
      await currentSub.save({ session });
      await company.save({ session });

      // 5. Save History
      await this.historyModel.create([{
        companyId: company._id,
        subscriptionId: currentSub._id,
        action,
        oldPlanId: oldPlanId,
        newPlanId: newPlan._id,
        oldPrice: oldPrice,
        newPrice: newPrice,
        creditGenerated: remainingCredit,
        walletUsed: walletUsed,
        paymentCollected: paymentRequired,
        startDate: now,
        endDate: nextMonth,
      }], { session });

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
    const items = await this.subModel.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('Subscriptions fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.subModel.findById(id);
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription fetched successfully', item);
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const item = await this.subModel.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
    });
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.subModel.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('Subscription not found');
    }
    return this.responseService.success('Subscription deleted successfully');
  }

  async previewPlanChange(companyId: string, newPlanId: string) {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new NotFoundException('Company not found');

    const currentSub = await this.subModel.findOne({ companyId });
    if (!currentSub) throw new NotFoundException('Active subscription not found');

    const newPlan = await this.planModel.findById(newPlanId);
    if (!newPlan) throw new NotFoundException('New plan not found');

    const { usedAmount, remainingCredit, elapsedDays, totalDays } = await this.calculateProration(currentSub);
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const newPrice = newPlan.monthlyPriceInr;

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

    return this.responseService.success('Plan change preview', {
      currentPlan: currentSub.planId, // Note: would need to populate name normally
      newPlan: newPlan.planType,
      currentPrice: currentSub.originalPrice,
      newPrice: newPrice,
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
