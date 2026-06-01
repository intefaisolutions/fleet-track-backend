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
  { displayName: string; description: string; features: string[] }
> = {
  [SubscriptionPlanType.FREE]: {
    displayName: 'Free',
    description: 'Ideal for trial periods',
    features: ['Basic GPS Tracking', 'Mobile App Access'],
  },
  [SubscriptionPlanType.BASIC]: {
    displayName: 'Basic',
    description: 'Small businesses',
    features: ['Real-time Analytics', 'Route Optimization'],
  },
  [SubscriptionPlanType.STANDARD]: {
    displayName: 'Standard',
    description: 'Growing fleets',
    features: ['Geofencing Alerts', 'Fuel Management'],
  },
  [SubscriptionPlanType.PREMIUM]: {
    displayName: 'Premium',
    description: 'Full enterprise power',
    features: ['AI Driver Scorecards', 'Priority Support 24/7'],
  },
  [SubscriptionPlanType.ENTERPRISE]: {
    displayName: 'Enterprise',
    description: 'Unlimited potential',
    features: ['Dedicated Manager', 'Custom Integrations'],
  },
};
