import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../constants/permissions.constant';
import { roleHasAnyPermission } from '../constants/role-permissions.constant';
import { ROLES } from '../constants/roles.constant';
import { AuthenticatedUser } from '../types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    // Company sub-admins: enforce explicit grant list when present (no licenses/companies keys).
    if (
      user.role === ROLES.COMPANY_ADMIN &&
      Array.isArray(user.permissions) &&
      user.permissions.length > 0
    ) {
      const fullRoleSignal =
        user.permissions.includes('companies:read') ||
        user.permissions.includes('licenses:read');
      if (!fullRoleSignal) {
        const granted = new Set(user.permissions);
        const ok = requiredPermissions.some((p) => granted.has(p));
        if (!ok) {
          throw new ForbiddenException(
            `Missing required permission(s): ${requiredPermissions.join(', ')}`,
          );
        }
        return true;
      }
    }

    if (!roleHasAnyPermission(user.role, requiredPermissions)) {
      throw new ForbiddenException(
        `Missing required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
