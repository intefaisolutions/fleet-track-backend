/**
 * Paths reachable before company license verification succeeds.
 * Matched against the path after stripping the global API prefix and query string.
 */
export const LICENSE_SESSION_FORBIDDEN_MESSAGE =
  'License verification required. Please verify your license key before accessing this resource.';

/** Route patterns allowed while license verification is pending */
export const LICENSE_SESSION_ALLOWLIST: RegExp[] = [
  /^\/?health\/?$/i,
  /^\/?auth(\/|$)/i,
  /^\/?companies\/register\/?$/i,
  /^\/?companies\/me\/license-activation\/?$/i,
  /^\/?companies\/me\/activate-license\/?$/i,
  /^\/?companies\/me\/resend-license-email\/?$/i,
  /^\/?licenses\/validate\/?$/i,
];

/**
 * Explicit protected resource prefixes (dashboard, vehicles, drivers, reports,
 * expenses, and other company APIs). Any non-allowlisted authenticated
 * company request is blocked; these are documented for clarity.
 */
export const LICENSE_SESSION_PROTECTED_PREFIXES = [
  '/vehicles',
  '/drivers',
  '/reports',
  '/expenses',
  '/analytics',
  '/companies',
  '/subscriptions',
  '/payments',
  '/wallets',
  '/users',
  '/notifications',
  '/settings',
  '/platform',
  '/storage',
] as const;
