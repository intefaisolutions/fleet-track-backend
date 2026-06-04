import { registerAs } from '@nestjs/config';

function parseCorsOrigin(value?: string): string | string[] {
  if (!value || value === '*') {
    return '*';
  }
  const origins = value.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'FleetTrack',
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  /** Public API URL (Swagger, webhooks) */
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  /**
   * Admin / owner web app URL (no trailing slash).
   * Emails: license register link, sign-in, forgot password.
   * Production: https://fleettrackservice.in
   */
  adminAppUrl: process.env.ADMIN_APP_URL || '',
  /** @deprecated use adminAppUrl — kept for older config reads */
  adminUrl: process.env.ADMIN_APP_URL || '',
  pathSignIn: process.env.APP_PATH_SIGN_IN || '/signin',
  pathRegisterCompany: process.env.APP_PATH_REGISTER_COMPANY || '/register-company',
  pathForgotPassword: process.env.APP_PATH_FORGOT_PASSWORD || '/forgot-password',
  superAdminSetupSecret: process.env.SUPER_ADMIN_SETUP_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  /** Days after validUntil that company users may still log in */
  licenseGracePeriodDays: parseInt(process.env.LICENSE_GRACE_PERIOD_DAYS || '7', 10),
}));
