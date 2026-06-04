import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppUrls } from '../common/utils/app-urls.util';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private readonly appUrls: AppUrls;

  constructor(private readonly configService: ConfigService) {
    this.appUrls = new AppUrls(configService);
    AppUrls.assertConfigured(configService);
  }

  private isConfigured(): boolean {
    const host = this.configService.get<string>('mail.host');
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');
    return Boolean(host && user && pass);
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('mail.host'),
        port: this.configService.get<number>('mail.port'),
        secure: this.configService.get<boolean>('mail.secure'),
        auth: {
          user: this.configService.get<string>('mail.user'),
          pass: this.configService.get<string>('mail.pass'),
        },
      });
    }
    return this.transporter;
  }

  async sendPasswordResetOtp(
    to: string,
    otp: string,
    recipientName?: string,
  ): Promise<boolean> {
    const enabled = this.configService.get<boolean>('mail.enabled');
    if (!enabled) {
      this.logger.warn(`Mail disabled; password reset OTP for ${to}: ${otp}`);
      return false;
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        `SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS); OTP for ${to}: ${otp}`,
      );
      return false;
    }

    const fromName = this.configService.get<string>('mail.fromName');
    const from = this.configService.get<string>('mail.from');
    const appName = this.configService.get<string>('app.name') || 'FleetTrack';
    const forgotUrl = this.appUrls.forgotPassword;
    const signInUrl = this.appUrls.signIn;

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #475569; line-height: 1.5;">
          Hi${recipientName ? ` ${recipientName}` : ''},
        </p>
        <p style="color: #475569; line-height: 1.5;">
          Use this one-time code to reset your ${appName} password. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="margin: 24px 0; padding: 16px 24px; background: #f0f9ff; border-radius: 12px; text-align: center;">
          <span style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #0284c7;">${otp}</span>
        </div>
        ${forgotUrl ? `<p style="margin-top: 20px;"><a href="${forgotUrl}" style="color: #00AEEF; font-weight: 600;">Open password reset page</a></p>` : ''}
        ${signInUrl ? `<p style="color: #94a3b8; font-size: 13px;">Sign in after reset: <a href="${signInUrl}" style="color: #64748b;">${signInUrl}</a></p>` : ''}
        <p style="color: #94a3b8; font-size: 13px;">
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `;

    try {
      await this.getTransporter().sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject: `${appName} — Password reset code`,
        text: `Your password reset code is ${otp}. It expires in 10 minutes.`,
        html,
      });
      this.logger.log(`Password reset OTP emailed to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
      throw err;
    }
  }

  async sendLicenseKeyEmail(
    to: string,
    licenseKey: string,
    details: {
      companyName?: string;
      contactPhone?: string;
      planType: string;
      validUntil: string;
      maxAdmins: number;
      maxOwners: number;
      maxDrivers: number;
      maxVehicles: number;
    },
  ): Promise<boolean> {
    const enabled = this.configService.get<boolean>('mail.enabled');
    if (!enabled || !this.isConfigured()) {
      this.logger.warn(
        `SMTP not configured; license ${licenseKey} for ${to} (not emailed)`,
      );
      return false;
    }

    const fromName = this.configService.get<string>('mail.fromName');
    const from = this.configService.get<string>('mail.from');
    const appName = this.configService.get<string>('app.name') || 'FleetTrack';
    const registerUrl = this.appUrls.buildRegisterCompanyUrl({
      licenseKey,
      companyName: details.companyName ?? '',
      email: to,
      phone: details.contactPhone,
    });

    if (!this.appUrls.base) {
      this.logger.warn(
        'ADMIN_APP_URL is not set — license email register link may be incomplete. Set ADMIN_APP_URL in .env (e.g. https://fleettrackservice.in)',
      );
    }

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a;">Your FleetTrack license key</h2>
        <p style="color: #475569; line-height: 1.6;">
          ${details.companyName ? `License issued for <strong>${details.companyName}</strong>.` : 'A new FleetTrack license has been issued for your organization.'}
        </p>
        <div style="margin: 24px 0; padding: 20px; background: #f0f9ff; border-radius: 12px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b; text-transform: uppercase;">License Key</p>
          <span style="font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #0284c7; font-family: monospace;">${licenseKey}</span>
        </div>
        <table style="width: 100%; font-size: 14px; color: #475569;">
          <tr><td style="padding: 4px 0;"><strong>Plan</strong></td><td>${details.planType}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Valid until</strong></td><td>${details.validUntil}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Admins / Owners / Drivers</strong></td><td>${details.maxAdmins} / ${details.maxOwners} / ${details.maxDrivers}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Max vehicles</strong></td><td>${details.maxVehicles}</td></tr>
        </table>
        <p style="margin-top: 24px;">
          <a href="${registerUrl}" style="display: inline-block; background: #00AEEF; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Register your company</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Use this key on the registration page. Do not share it publicly.</p>
      </div>
    `;

    try {
      await this.getTransporter().sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject: `${appName} — Your license key (${details.planType})`,
        text: `Your FleetTrack license key is ${licenseKey}. Plan: ${details.planType}. Valid until ${details.validUntil}. Register at ${registerUrl}`,
        html,
      });
      this.logger.log(`License key emailed to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send license email to ${to}`, err);
      throw err;
    }
  }
}
