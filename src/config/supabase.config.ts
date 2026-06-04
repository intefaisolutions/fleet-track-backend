import { registerAs } from '@nestjs/config';

/** Supabase Storage — use service_role on server only (never expose to browser). */
export default registerAs('supabase', () => ({
  url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  serviceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '',
  bucket: process.env.SUPABASE_STORAGE_BUCKET || 'fleet-uploads',
  enabled: process.env.SUPABASE_ENABLED !== 'false',
}));
