export enum Permission {
  // Users
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',

  // Companies
  COMPANIES_READ = 'companies:read',
  COMPANIES_WRITE = 'companies:write',
  COMPANIES_DELETE = 'companies:delete',

  // Fleet
  VEHICLES_READ = 'vehicles:read',
  VEHICLES_WRITE = 'vehicles:write',
  VEHICLES_DELETE = 'vehicles:delete',
  DRIVERS_READ = 'drivers:read',
  DRIVERS_WRITE = 'drivers:write',
  DRIVERS_DELETE = 'drivers:delete',

  // Operations
  EXPENSES_READ = 'expenses:read',
  EXPENSES_WRITE = 'expenses:write',
  REPORTS_READ = 'reports:read',
  REPORTS_WRITE = 'reports:write',
  ANALYTICS_READ = 'analytics:read',

  // Billing
  SUBSCRIPTIONS_READ = 'subscriptions:read',
  SUBSCRIPTIONS_WRITE = 'subscriptions:write',
  PAYMENTS_READ = 'payments:read',
  PAYMENTS_WRITE = 'payments:write',
  LICENSES_READ = 'licenses:read',
  LICENSES_WRITE = 'licenses:write',

  // System
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',
  NOTIFICATIONS_READ = 'notifications:read',
  NOTIFICATIONS_WRITE = 'notifications:write',
}
