/**
 * Push-ready architecture: swap NoopPushProvider for FCM/APNs later.
 */
export const PUSH_NOTIFICATION_PROVIDER = Symbol('PUSH_NOTIFICATION_PROVIDER');

export interface PushDispatchPayload {
  userId?: string;
  companyId?: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
  notificationId?: string;
}

export interface PushNotificationProvider {
  /**
   * Send a push notification to the user's registered devices.
   * Returns true when at least one device was targeted successfully.
   */
  send(payload: PushDispatchPayload): Promise<boolean>;
}
