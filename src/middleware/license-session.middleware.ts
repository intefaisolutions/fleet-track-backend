import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';
import { APP_CONSTANTS } from '../constants/app.constant';
import { ROLES } from '../constants/roles.constant';
import {
  Company,
  CompanyDocument,
} from '../companies/schemas/company.schema';
import { companyRequiresLicenseActivation } from '../companies/services/companies.service';
import { JwtPayload } from '../types';
import {
  LICENSE_SESSION_ALLOWLIST,
  LICENSE_SESSION_FORBIDDEN_MESSAGE,
} from './license-session.constants';

/**
 * License-based session middleware.
 *
 * Until company license verification succeeds, blocks Company Admin (and other
 * company-scoped) access to Dashboard / Vehicles / Drivers / Reports /
 * Expenses and remaining protected APIs with HTTP 403.
 *
 * Allowlisted: auth, license activation endpoints, public register/validate.
 */
@Injectable()
export class LicenseSessionMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const path = this.normalizePath(req.originalUrl || req.url || '');

      if (this.isAllowlisted(path)) {
        return next();
      }

      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        return next();
      }

      const token = header.slice(7).trim();
      if (!token) {
        return next();
      }

      let payload: JwtPayload;
      try {
        payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret:
            this.configService.get<string>('jwt.accessSecret') ||
            'change-access-secret-in-production',
        });
      } catch {
        // Invalid/expired token — JwtAuthGuard returns 401
        return next();
      }

      if (payload.type && payload.type !== 'access') {
        return next();
      }

      if (
        payload.role === ROLES.SUPER_ADMIN ||
        payload.role === ROLES.SUPPORT_ADMIN
      ) {
        return next();
      }

      const companyId = payload.companyId;
      if (!companyId) {
        return next();
      }

      const requiresActivation =
        await this.companyRequiresActivation(companyId);
      if (!requiresActivation) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: LICENSE_SESSION_FORBIDDEN_MESSAGE,
        error: 'ForbiddenException',
        data: {
          requiresLicenseActivation: true,
          code: 'LICENSE_VERIFICATION_REQUIRED',
        },
      });
    } catch (err) {
      return next(err);
    }
  }

  private normalizePath(rawUrl: string): string {
    const withoutQuery = rawUrl.split('?')[0] || '';
    const prefix = `/${APP_CONSTANTS.API_PREFIX}`.replace(/\/+/g, '/');
    let path = withoutQuery;
    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length) || '/';
    }
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    return path.replace(/\/+$/, '') || '/';
  }

  private isAllowlisted(path: string): boolean {
    return LICENSE_SESSION_ALLOWLIST.some((pattern) => pattern.test(path));
  }

  private async companyRequiresActivation(
    companyId: string,
  ): Promise<boolean> {
    const company = await this.companyModel
      .findById(companyId)
      .select('licenseId licenseActivated')
      .lean();
    if (!company) {
      return false;
    }
    return companyRequiresLicenseActivation(company);
  }
}
