/** Driver session inactivity policy (SRS) */
export const DRIVER_INACTIVITY_DAYS = 7;

export const DRIVER_INACTIVITY_MS =
  DRIVER_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

/** Do not write lastActivity more often than this (active users keep using the app) */
export const DRIVER_ACTIVITY_TOUCH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export const DRIVER_SESSION_EXPIRED_MESSAGE =
  'Session expired due to 7 days of inactivity. Please login again.';
