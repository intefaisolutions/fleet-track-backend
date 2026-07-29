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

/** How the customer chose to pay for a subscription upgrade */
export enum PaymentMethodType {
  RAZORPAY = 'RAZORPAY',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
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

/** SRS Section 8 — categories 8.1–8.7 + Other */
export enum ExpenseCategory {
  FUEL = 'FUEL',
  SERVICE = 'SERVICE',
  TOLL = 'TOLL',
  REPAIR = 'REPAIR',
  INSURANCE = 'INSURANCE',
  PUC = 'PUC',
  CHALLAN = 'CHALLAN',
  OTHER = 'OTHER',
}

/** In-app / push notification event types */
export enum NotificationType {
  INSURANCE_EXPIRY = 'INSURANCE_EXPIRY',
  PUC_EXPIRY = 'PUC_EXPIRY',
  LICENSE_EXPIRY = 'LICENSE_EXPIRY',
  PAYMENT_VERIFICATION = 'PAYMENT_VERIFICATION',
  VEHICLE_LIMIT = 'VEHICLE_LIMIT',
  DRIVER_ASSIGNMENT = 'DRIVER_ASSIGNMENT',
  REPAIR_REQUEST = 'REPAIR_REQUEST',
  SYSTEM = 'SYSTEM',
}

export enum NotificationPushStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
}
