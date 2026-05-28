import { registerAs } from '@nestjs/config';

function parseCorsOrigin(value?: string): string | string[] {
  if (!value || value === '*') {
    return '*';
  }
  const origins = value.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'Fleet SaaS',
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  superAdminSetupSecret: process.env.SUPER_ADMIN_SETUP_SECRET || '',
}));
