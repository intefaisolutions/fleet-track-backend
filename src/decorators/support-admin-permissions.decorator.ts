import { SetMetadata } from '@nestjs/common';

export const SUPPORT_ADMIN_PERMISSIONS_KEY = 'supportAdminPermissions';

/** Required permission keys for SUPPORT_ADMIN (e.g. dashboard:read). SUPER_ADMIN bypasses. */
export const SupportAdminPermissions = (...permissions: string[]) =>
  SetMetadata(SUPPORT_ADMIN_PERMISSIONS_KEY, permissions);
