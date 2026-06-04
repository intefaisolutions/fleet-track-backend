import { ConfigService } from '@nestjs/config';

/** Frontend portal base URL and paths — all from .env (see ADMIN_APP_URL, APP_PATH_*). */
export class AppUrls {
  readonly base: string;
  readonly signIn: string;
  readonly registerCompany: string;
  readonly forgotPassword: string;

  constructor(config: ConfigService) {
    const nodeEnv = config.get<string>('app.nodeEnv') || 'development';
    let raw =
      config.get<string>('app.adminAppUrl')?.trim() ||
      config.get<string>('app.adminUrl')?.trim() ||
      '';
    if (!raw && nodeEnv !== 'production') {
      raw = 'http://localhost:5173';
    }
    this.base = raw.replace(/\/$/, '');

    const signInPath =
      config.get<string>('app.pathSignIn') || '/signin';
    const registerPath =
      config.get<string>('app.pathRegisterCompany') || '/register-company';
    const forgotPath =
      config.get<string>('app.pathForgotPassword') || '/forgot-password';

    this.signIn = this.joinPath(signInPath);
    this.registerCompany = this.joinPath(registerPath);
    this.forgotPassword = this.joinPath(forgotPath);
  }

  private joinPath(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    if (!this.base) {
      return p;
    }
    return `${this.base}${p}`;
  }

  /** License / company registration link with query params */
  buildRegisterCompanyUrl(params: Record<string, string | undefined>): string {
    const url = new URL(this.registerCompany);
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  static assertConfigured(config: ConfigService): void {
    const nodeEnv = config.get<string>('app.nodeEnv') || 'development';
    const base =
      config.get<string>('app.adminAppUrl')?.trim() ||
      config.get<string>('app.adminUrl')?.trim() ||
      '';
    if (nodeEnv === 'production' && (!base || base.includes('localhost'))) {
      console.warn(
        '[Fleet] ADMIN_APP_URL is missing or still localhost in production — emails will use wrong links. Set ADMIN_APP_URL=https://fleettrackservice.in',
      );
    }
  }
}
