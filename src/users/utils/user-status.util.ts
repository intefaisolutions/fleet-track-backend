import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '../../common/enums';

const STATUS_MESSAGES: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: '',
  [UserStatus.INACTIVE]: 'Your account is deactivated. Contact your administrator.',
  [UserStatus.SUSPENDED]: 'Your account has been suspended. Contact support.',
  [UserStatus.PENDING_APPROVAL]:
    'Your account is pending approval. Please wait for admin activation.',
};

export function assertUserCanAuthenticate(status: UserStatus): void {
  if (status === UserStatus.ACTIVE) {
    return;
  }

  throw new UnauthorizedException(
    STATUS_MESSAGES[status] || 'Account is not allowed to sign in',
  );
}

export function isUserLoginAllowed(status: UserStatus): boolean {
  return status === UserStatus.ACTIVE;
}
