/**
 * Permissions a company sub-admin may be granted.
 * Maps to Company Admin sidebar areas (Admins page is primary-admin only).
 */
export const COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS = [
  'analytics:read',
  'reports:read',
  'reports:write',
  'vehicles:read',
  'vehicles:write',
  'vehicles:delete',
  'drivers:read',
  'drivers:write',
  'drivers:delete',
  'expenses:read',
  'expenses:write',
  'users:read',
  'users:write',
  'users:delete',
  'subscriptions:read',
  'payments:read',
  'settings:read',
  'settings:write',
] as const;

export type CompanySubAdminPermission =
  (typeof COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS)[number];

export function assertCompanySubAdminPermissions(permissions: string[]): void {
  const invalid = permissions.filter(
    (p) =>
      !COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS.includes(
        p as CompanySubAdminPermission,
      ),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Invalid sub-admin permissions: ${invalid.join(', ')}. Choose only View / Create / Edit / Delete options shown in the form.`,
    );
  }
}
