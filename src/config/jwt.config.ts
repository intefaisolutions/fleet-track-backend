import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    'change-access-secret-in-production',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    'change-refresh-secret-in-production',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN || '1h',
}));
