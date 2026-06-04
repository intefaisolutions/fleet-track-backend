/** SRS 4-tier roles */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  VEHICLE_OWNER = 'VEHICLE_OWNER',
  DRIVER = 'DRIVER',
  /** @deprecated Use VEHICLE_OWNER — kept for existing records */
  FLEET_MANAGER = 'FLEET_MANAGER',
  /** @deprecated SRS uses 4 roles only */
  ACCOUNTANT = 'ACCOUNTANT',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export enum CompanyStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

/** SRS subscription plans */
export enum SubscriptionPlanType {
  FREE = 'FREE',
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  TRIAL = 'TRIAL',
}

/** SRS license key lifecycle */
export enum LicenseKeyStatus {
  UNUSED = 'UNUSED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum BillingPeriod {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum VehicleType {
  TRUCK = 'TRUCK',
  VAN = 'VAN',
  CAR = 'CAR',
  BIKE = 'BIKE',
  OTHER = 'OTHER',
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
}

export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_TRIP = 'ON_TRIP',
  SUSPENDED = 'SUSPENDED',
}

/** SRS Section 8 — seven expense categories */
export enum ExpenseCategory {
  FUEL = 'FUEL',
  SERVICE = 'SERVICE',
  INSURANCE = 'INSURANCE',
  PUC = 'PUC',
  TOLL = 'TOLL',
  CHALLAN = 'CHALLAN',
  OTHER = 'OTHER',
}

export enum NotificationType {
  ALERT = 'ALERT',
  REMINDER = 'REMINDER',
  SYSTEM = 'SYSTEM',
  TRACKING = 'TRACKING',
  PAYMENT = 'PAYMENT',
  LICENSE = 'LICENSE',
}
