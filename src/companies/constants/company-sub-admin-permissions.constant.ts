/** Permissions a company sub-admin may be granted (subset of company admin portal). */
export const COMPANY_SUB_ADMIN_ALLOWED_PERMISSIONS = [
  'users:read',
  'users:write',
  'users:delete',
  'expenses:read',
  'vehicles:read',
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
      `Invalid sub-admin permissions: ${invalid.join(', ')}. Vehicles and expenses are view-only for company admins.`,
    );
  }
}
