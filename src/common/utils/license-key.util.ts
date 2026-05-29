import { randomBytes } from 'crypto';

/** SRS format: FLT-XXXX-YYYY-ZZZZ-WWWW */
export function generateLicenseKey(): string {
  const segment = () =>
    randomBytes(2).toString('hex').toUpperCase().padStart(4, '0').slice(0, 4);
  return `FLT-${segment()}-${segment()}-${segment()}-${segment()}`;
}

export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, '');
}
