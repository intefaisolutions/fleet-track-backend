import { Role } from '../constants/roles.constant';

export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  companyId?: string;
  type: TokenType;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  companyId?: string;
  /** SUPPORT_ADMIN only — route permission keys from user record */
  permissions?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}
