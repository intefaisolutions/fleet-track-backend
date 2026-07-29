import { BillingPeriod } from '../enums';

/**
 * Billing cycle starts on the purchase/activation date (not calendar month/year start).
 * Monthly → same day next month; Yearly → same day next year.
 */
export function addBillingPeriod(
  from: Date,
  billingPeriod: BillingPeriod,
): Date {
  const end = new Date(from.getTime());
  if (billingPeriod === BillingPeriod.YEARLY) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export function planPriceForPeriod(
  plan: { monthlyPriceInr: number; yearlyPriceInr: number },
  billingPeriod: BillingPeriod,
): number {
  return billingPeriod === BillingPeriod.YEARLY
    ? plan.yearlyPriceInr
    : plan.monthlyPriceInr;
}
