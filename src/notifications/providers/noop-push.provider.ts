import { Injectable, Logger } from '@nestjs/common';
import {
  PushDispatchPayload,
  PushNotificationProvider,
} from './push-notification.provider';

/**
 * Placeholder provider — logs only.
 * Replace with FCM / OneSignal / APNs implementation without changing callers.
 */
@Injectable()
export class NoopPushNotificationProvider implements PushNotificationProvider {
  private readonly logger = new Logger(NoopPushNotificationProvider.name);

  async send(payload: PushDispatchPayload): Promise<boolean> {
    this.logger.debug(
      `[push:noop] type=${payload.type} user=${payload.userId ?? '-'} title="${payload.title}"`,
    );
    // Ready for real provider: return false so status stays SKIPPED until devices exist
    return false;
  }
}
