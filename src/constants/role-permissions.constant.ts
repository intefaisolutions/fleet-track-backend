import { ROLES, Role } from './roles.constant';
import { Permission } from './permissions.constant';

const ALL_PERMISSIONS = Object.values(Permission);

const COMPANY_ADMIN_PERMISSIONS: Permission[] = [
  Permission.USERS_READ,
  Permission.USERS_WRITE,
  Permission.VEHICLES_READ,
  Permission.VEHICLES_WRITE,
  Permission.VEHICLES_DELETE,
  Permission.DRIVERS_READ,
  Permission.DRIVERS_WRITE,
  Permission.DRIVERS_DELETE,
  Permission.EXPENSES_READ,
  Permission.EXPENSES_WRITE,
  Permission.REPORTS_READ,
  Permission.REPORTS_WRITE,
  Permission.ANALYTICS_READ,
  Permission.SUBSCRIPTIONS_READ,
  Permission.PAYMENTS_READ,
  Permission.LICENSES_READ,
  Permission.LICENSES_WRITE,
  Permission.SETTINGS_READ,
  Permission.SETTINGS_WRITE,
  Permission.NOTIFICATIONS_READ,
  Permission.NOTIFICATIONS_WRITE,
];

const FLEET_MANAGER_PERMISSIONS: Permission[] = [
  Permission.USERS_READ,
  Permission.VEHICLES_READ,
  Permission.VEHICLES_WRITE,
  Permission.DRIVERS_READ,
  Permission.DRIVERS_WRITE,
  Permission.EXPENSES_READ,
  Permission.EXPENSES_WRITE,
  Permission.REPORTS_READ,
  Permission.ANALYTICS_READ,
  Permission.LICENSES_READ,
  Permission.NOTIFICATIONS_READ,
];

const DRIVER_PERMISSIONS: Permission[] = [
  Permission.VEHICLES_READ,
  Permission.DRIVERS_READ,
  Permission.EXPENSES_READ,
  Permission.EXPENSES_WRITE,
  Permission.NOTIFICATIONS_READ,
];

const ACCOUNTANT_PERMISSIONS: Permission[] = [
  Permission.EXPENSES_READ,
  Permission.EXPENSES_WRITE,
  Permission.REPORTS_READ,
  Permission.REPORTS_WRITE,
  Permission.ANALYTICS_READ,
  Permission.PAYMENTS_READ,
  Permission.SUBSCRIPTIONS_READ,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.COMPANY_ADMIN]: COMPANY_ADMIN_PERMISSIONS,
  [ROLES.FLEET_MANAGER]: FLEET_MANAGER_PERMISSIONS,
  [ROLES.DRIVER]: DRIVER_PERMISSIONS,
  [ROLES.ACCOUNTANT]: ACCOUNTANT_PERMISSIONS,
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function roleHasAnyPermission(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => roleHasPermission(role, p));
}
