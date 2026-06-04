import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUPPORT_ADMIN_PERMISSIONS_KEY } from '../decorators/support-admin-permissions.decorator';
import { ROLES } from '../constants/roles.constant';
import { AuthenticatedUser } from '../types';

/** Grants all read-only platform routes when assigned to a support admin */
export const SUPPORT_PLATFORM_READ = 'platform:read';

@Injectable()
export class SupportAdminPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      SUPPORT_ADMIN_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as (AuthenticatedUser & { permissions?: string[] }) | undefined;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    if (user.role !== ROLES.SUPPORT_ADMIN) {
      return true;
    }

    const granted = user.permissions ?? [];
    if (granted.includes(SUPPORT_PLATFORM_READ)) {
      return true;
    }

    const hasOne = required.some((key) => granted.includes(key));
    if (!hasOne) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
