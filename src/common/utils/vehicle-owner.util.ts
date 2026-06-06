import { ROLES, type Role } from '../../constants/roles.constant';

/** Vehicle owners in the field (includes legacy FLEET_MANAGER records). */
export function resolveVehicleOwnerUserId(role: Role, userId: string): string | undefined {
  if (role === ROLES.VEHICLE_OWNER || role === ROLES.FLEET_MANAGER) {
    return userId;
  }
  return undefined;
}
