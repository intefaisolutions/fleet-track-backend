export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  FLEET_MANAGER: 'FLEET_MANAGER',
  DRIVER: 'DRIVER',
  ACCOUNTANT: 'ACCOUNTANT',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
