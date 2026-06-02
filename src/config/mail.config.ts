import { registerAs } from '@nestjs/config';

/** SMTP settings for forgot-password OTP (see .env SMTP_* / MAIL_*). */
export default registerAs('mail', () => ({
  enabled: process.env.MAIL_ENABLED !== 'false',
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from:
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    'noreply@fleettrack.com',
  fromName: process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'FleetTrack',
}));
