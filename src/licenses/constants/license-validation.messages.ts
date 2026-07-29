/**
 * Centralized, meaningful messages for license validation failures.
 * Keep copy stable so UI and APIs can rely on consistent wording.
 */
export enum LicenseValidationFailure {
  NOT_FOUND = 'LICENSE_NOT_FOUND',
  NOT_ACTIVE = 'LICENSE_NOT_ACTIVE',
  EXPIRED = 'LICENSE_EXPIRED',
  REVOKED = 'LICENSE_REVOKED',
  REVOKED_GRACE_ENDED = 'LICENSE_REVOKED_GRACE_ENDED',
  CANCELLED = 'LICENSE_CANCELLED',
  ALREADY_USED = 'LICENSE_ALREADY_USED',
  ALREADY_USED_BY_OTHER = 'LICENSE_ALREADY_USED_BY_OTHER',
  KEY_MISMATCH = 'LICENSE_KEY_MISMATCH',
  EMAIL_DUPLICATE = 'COMPANY_EMAIL_DUPLICATE',
  KEY_REQUIRED = 'LICENSE_KEY_REQUIRED',
}

export const LICENSE_VALIDATION_MESSAGES: Record<
  LicenseValidationFailure,
  string
> = {
  [LicenseValidationFailure.NOT_FOUND]:
    'License does not exist. Please check the key and try again.',
  [LicenseValidationFailure.NOT_ACTIVE]:
    'License is not active. Please contact support for assistance.',
  [LicenseValidationFailure.EXPIRED]:
    'License has expired. Please renew or contact your service provider.',
  [LicenseValidationFailure.REVOKED]:
    'License has been revoked. Please contact support for assistance.',
  [LicenseValidationFailure.REVOKED_GRACE_ENDED]:
    'License has been revoked and the grace period has ended. Please contact support.',
  [LicenseValidationFailure.CANCELLED]:
    'License has been cancelled. Please contact support for assistance.',
  [LicenseValidationFailure.ALREADY_USED]:
    'License has already been used and cannot be reused.',
  [LicenseValidationFailure.ALREADY_USED_BY_OTHER]:
    'License has already been used by another company.',
  [LicenseValidationFailure.KEY_MISMATCH]:
    'License key does not match the key assigned to your company. Please check and try again.',
  [LicenseValidationFailure.EMAIL_DUPLICATE]:
    'A company with this email already exists. Please use a different email address.',
  [LicenseValidationFailure.KEY_REQUIRED]:
    'License key is required.',
};

export function licenseValidationMessage(
  failure: LicenseValidationFailure,
): string {
  return LICENSE_VALIDATION_MESSAGES[failure];
}
