export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  FLEET_MANAGER = 'FLEET_MANAGER',
  DRIVER = 'DRIVER',
  ACCOUNTANT = 'ACCOUNTANT',
}

/** User account lifecycle — matches Figma: activate, suspend, pending approval */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  TRIAL = 'TRIAL',
}

export enum CompanyStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
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

export enum ExpenseCategory {
  FUEL = 'FUEL',
  MAINTENANCE = 'MAINTENANCE',
  INSURANCE = 'INSURANCE',
  TOLL = 'TOLL',
  OTHER = 'OTHER',
}

export enum LicenseStatus {
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
}

export enum NotificationType {
  ALERT = 'ALERT',
  REMINDER = 'REMINDER',
  SYSTEM = 'SYSTEM',
  TRACKING = 'TRACKING',
}
