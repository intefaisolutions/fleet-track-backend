import { SubscriptionPlanType } from '../enums';

export interface PlanLimits {
  vehicleLimit: number;
  maxAdmins: number;
  maxOwners: number;
  maxDrivers: number;
  monthlyPriceInr: number;
  yearlyPriceInr: number;
}

/** Default SRS plan limits & pricing */
export const DEFAULT_PLAN_LIMITS: Record<SubscriptionPlanType, PlanLimits> = {
  [SubscriptionPlanType.FREE]: {
    vehicleLimit: 5,
    maxAdmins: 1,
    maxOwners: 2,
    maxDrivers: 5,
    monthlyPriceInr: 0,
    yearlyPriceInr: 0,
  },
  [SubscriptionPlanType.BASIC]: {
    vehicleLimit: 10,
    maxAdmins: 2,
    maxOwners: 5,
    maxDrivers: 15,
    monthlyPriceInr: 299,
    yearlyPriceInr: 2999,
  },
  [SubscriptionPlanType.STANDARD]: {
    vehicleLimit: 20,
    maxAdmins: 3,
    maxOwners: 10,
    maxDrivers: 30,
    monthlyPriceInr: 799,
    yearlyPriceInr: 7999,
  },
  [SubscriptionPlanType.PREMIUM]: {
    vehicleLimit: 50,
    maxAdmins: 3,
    maxOwners: 10,
    maxDrivers: 50,
    monthlyPriceInr: 1599,
    yearlyPriceInr: 15999,
  },
  [SubscriptionPlanType.ENTERPRISE]: {
    vehicleLimit: 9999,
    maxAdmins: 10,
    maxOwners: 100,
    maxDrivers: 500,
    monthlyPriceInr: 2999,
    yearlyPriceInr: 29999,
  },
};

export const PLAN_MARKETING: Record<
  SubscriptionPlanType,
  {
    displayName: string;
    description: string;
    features: string[];
    supportType: string;
    dataRetentionDays: number;
  }
> = {
  [SubscriptionPlanType.FREE]: {
    displayName: 'Free',
    description: 'Ideal for trial periods',
    features: ['Basic logbook', '7-day data', 'Community support'],
    supportType: 'Community',
    dataRetentionDays: 7,
  },
  [SubscriptionPlanType.BASIC]: {
    displayName: 'Basic',
    description: 'Small businesses',
    features: ['Fuel cost calculator', 'Driver assignment', 'Export to Excel'],
    supportType: 'Email',
    dataRetentionDays: 14,
  },
  [SubscriptionPlanType.STANDARD]: {
    displayName: 'Standard',
    description: 'Growing fleets',
    features: ['Maintenance scheduling', 'Document expiry alerts', 'Chat support'],
    supportType: 'Chat + Email',
    dataRetentionDays: 60,
  },
  [SubscriptionPlanType.PREMIUM]: {
    displayName: 'Premium',
    description: 'Full enterprise power',
    features: ['Efficiency reports', 'Expense approval workflow', 'Vendor management'],
    supportType: 'Priority Chat',
    dataRetentionDays: 180,
  },
  [SubscriptionPlanType.ENTERPRISE]: {
    displayName: 'Enterprise',
    description: 'Unlimited potential',
    features: ['Custom reports', 'White-label', '24x7 phone support', '1 year+ data'],
    supportType: '24x7 Phone',
    dataRetentionDays: 365,
  },
};
