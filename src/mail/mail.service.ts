import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

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
}
