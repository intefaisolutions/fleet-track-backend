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

  /** Login credentials when a company admin creates a vehicle owner or driver. */
  async sendAccountWelcomeEmail(params: {
    to: string;
    fullName: string;
    password: string;
    roleLabel: string;
    companyName?: string;
  }): Promise<boolean> {
    const { to, fullName, password, roleLabel, companyName } = params;
    const enabled = this.configService.get<boolean>('mail.enabled');
    if (!enabled) {
      this.logger.warn(
        `Mail disabled; welcome email for ${to} (${roleLabel}) not sent`,
      );
      return false;
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        `SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS); welcome email for ${to} not sent`,
      );
      return false;
    }

    const fromName = this.configService.get<string>('mail.fromName');
    const from = this.configService.get<string>('mail.from');
    const appName = this.configService.get<string>('app.name') || 'FleetTrack';
    const signInUrl = this.appUrls.signIn;
    const forgotUrl = this.appUrls.forgotPassword;

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Your ${appName} account</h2>
        <p style="color: #475569; line-height: 1.5;">
          Hi ${fullName},
        </p>
        <p style="color: #475569; line-height: 1.5;">
          ${companyName ? `You have been added to <strong>${companyName}</strong> as a <strong>${roleLabel}</strong>.` : `You have been added as a <strong>${roleLabel}</strong>.`}
          Use the credentials below to sign in${signInUrl ? ` at <a href="${signInUrl}" style="color: #00AEEF;">${signInUrl}</a>` : ''}.
        </p>
        <table style="width: 100%; margin: 20px 0; font-size: 14px; color: #475569; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Email</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${to}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Temporary password</strong></td><td style="padding: 8px 0; font-family: monospace;">${password}</td></tr>
        </table>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
          For security, change your password after your first sign-in${forgotUrl ? ` using <a href="${forgotUrl}" style="color: #00AEEF;">Forgot password</a> if needed` : ''}.
        </p>
        ${signInUrl ? `<p style="margin-top: 24px;"><a href="${signInUrl}" style="display: inline-block; background: #00AEEF; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Sign in</a></p>` : ''}
      </div>
    `;

    const text = [
      `Hi ${fullName},`,
      companyName
        ? `You were added to ${companyName} as ${roleLabel}.`
        : `You were added as ${roleLabel}.`,
      `Email: ${to}`,
      `Temporary password: ${password}`,
      signInUrl ? `Sign in: ${signInUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await this.getTransporter().sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject: `${appName} — Your ${roleLabel} account`,
        text,
        html,
      });
      this.logger.log(`Welcome email sent to ${to} (${roleLabel})`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send welcome email to ${to}`, err);
      return false;
    }
  }

  /** Notification when a company is suspended */
  async sendCompanySuspensionEmail(
    to: string,
    companyName: string,
    reason: string,
    validity?: string,
  ): Promise<boolean> {
    const enabled = this.configService.get<boolean>('mail.enabled');
    if (!enabled || !this.isConfigured()) {
      this.logger.warn(
        `Mail disabled or SMTP not configured; suspension email for ${to} not sent`,
      );
      return false;
    }

    const fromName = this.configService.get<string>('mail.fromName');
    const from = this.configService.get<string>('mail.from');
    const appName = this.configService.get<string>('app.name') || 'FleetTrack';

    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #dc2626; margin-bottom: 8px;">Account Suspended</h2>
        <p style="color: #475569; line-height: 1.5;">
          Dear <strong>${companyName} Team</strong>,
        </p>
        <p style="color: #475569; line-height: 1.5;">
          Your ${appName} account has been suspended by the administrator.
        </p>
        <div style="margin: 20px 0; padding: 16px; background: #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #991b1b;">Reason:</p>
          <p style="margin: 0 0 12px; color: #7f1d1d;">${reason}</p>
          <p style="margin: 0; color: #7f1d1d; font-size: 13px; line-height: 1.5;">
            Your organization ("${companyName}") has been suspended. All users associated with this organization will be unable to access the system until the account is reactivated.
          </p>
        </div>
        <table style="width: 100%; margin: 20px 0; font-size: 14px; color: #475569; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Suspended On</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${today}</td>
          </tr>
          ${validity ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>License Valid Until</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${validity}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Status</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><span style="color: #dc2626; font-weight: bold;">Suspended</span></td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
          If you believe this suspension is an error, please contact our support team at <a href="mailto:support@fleettrackservice.in" style="color: #2563eb; text-decoration: none;">support@fleettrackservice.in</a>.
        </p>
      </div>
    `;

    const text = [
      `Dear ${companyName} Team,`,
      `Your ${appName} account has been suspended by the administrator.`,
      `Reason: ${reason}`,
      `Your organization ("${companyName}") has been suspended. All users associated with this organization will be unable to access the system until the account is reactivated.`,
      `Suspended On: ${today}`,
      validity ? `License Valid Until: ${validity}` : '',
      `Status: Suspended`,
      `If you believe this suspension is an error, please contact our support team at support@fleettrackservice.in`
    ].filter(Boolean).join('\n');

    try {
      await this.getTransporter().sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject: `${appName} — Account Suspended`,
        text,
        html,
      });
      this.logger.log(`Suspension email sent to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send suspension email to ${to}`, err);
      return false;
    }
  }

  /** Notification when a sub-admin is invited */
  async sendSubAdminInviteEmail(
    to: string,
    name: string,
    companyName: string,
    plainPassword: string,
    loginUrl: string,
  ): Promise<boolean> {
    const enabled = this.configService.get<boolean>('mail.enabled');
    if (!enabled || !this.isConfigured()) {
      this.logger.warn(
        `Mail disabled or SMTP not configured; sub-admin invite email for ${to} not sent`,
      );
      return false;
    }

    const fromName = this.configService.get<string>('mail.fromName');
    const from = this.configService.get<string>('mail.from');
    const appName = this.configService.get<string>('app.name') || 'FleetTrack';

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0369a1; margin-bottom: 8px;">Welcome to ${appName}!</h2>
        <p style="color: #475569; line-height: 1.5;">
          Dear <strong>${name}</strong>,
        </p>
        <p style="color: #475569; line-height: 1.5;">
          You have been invited by <strong>${companyName}</strong> to join as a Sub-Admin.
        </p>
        <div style="margin: 20px 0; padding: 16px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #075985;">Your Login Credentials:</p>
          <p style="margin: 0 0 4px; color: #0c4a6e;">Email: <strong>${to}</strong></p>
          <p style="margin: 0; color: #0c4a6e;">Temporary Password: <strong>${plainPassword}</strong></p>
        </div>
        <p style="color: #475569; line-height: 1.5;">
          Please log in using the link below:
        </p>
        <a href="${loginUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #0ea5e9; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Login Now</a>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 24px;">
          For security reasons, we strongly recommend changing your password immediately after your first login.
        </p>
      </div>
    `;

    const text = [
      `Dear ${name},`,
      `You have been invited by ${companyName} to join as a Sub-Admin on ${appName}.`,
      `Your Login Credentials:`,
      `Email: ${to}`,
      `Temporary Password: ${plainPassword}`,
      `Login URL: ${loginUrl}`,
      `Please change your password immediately after logging in.`
    ].join('\n');

    try {
      await this.getTransporter().sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject: `You've been invited as a Sub-Admin to ${companyName}`,
        text,
        html,
      });
      this.logger.log(`Sub-admin invite email sent to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send sub-admin invite email to ${to}`, err);
      return false;
    }
  }
}
