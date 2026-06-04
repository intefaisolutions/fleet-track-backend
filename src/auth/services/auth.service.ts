import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '../../common/enums';
import { ResponseService } from '../../common/responses/response.service';
import { ROLE_PERMISSIONS } from '../../constants/role-permissions.constant';
import { UsersService } from '../../users/services/users.service';
import { assertUserCanAuthenticate } from '../../users/utils/user-status.util';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';
import { SetupSuperAdminDto } from '../dto/setup-super-admin.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { UserDocument } from '../../users/schemas/user.schema';
import { MailService } from '../../mail/mail.service';
import { LicensesService } from '../../licenses/services/licenses.service';
import { ROLES } from '../../constants/roles.constant';
import { normalizeEmail } from '../../common/utils/contact.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly responseService: ResponseService,
    private readonly mailService: MailService,
    private readonly licensesService: LicensesService,
  ) {}

  private async assertLicenseAccessForUser(user: UserDocument) {
    if (user.role === ROLES.SUPER_ADMIN || !user.companyId) {
      return;
    }
    await this.licensesService.assertCompanyLicenseAllowsAccess(
      user.companyId.toString(),
    );
  }

  private sanitizeUser(user: UserDocument) {
    const isSupportAdmin = user.role === UserRole.SUPPORT_ADMIN;
    return {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profileImage: user.profileImage ?? null,
      isEmailVerified: user.isEmailVerified,
      companyId: user.companyId,
      lastLogin: user.lastLogin,
      permissions: isSupportAdmin
        ? (user.permissions ?? [])
        : (ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? []),
    };
  }

  async register(dto: RegisterDto) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super Admin cannot self-register. Use POST /auth/setup-super-admin once (first time only).',
      );
    }

    return this.usersService.create(
      { ...dto, role: dto.role ?? UserRole.FLEET_MANAGER },
      { status: UserStatus.PENDING_APPROVAL },
    );
  }

  /**
   * One-time setup: creates the only Super Admin in the system.
   * Works only when no SUPER_ADMIN exists yet + valid setup secret from .env
   */
  async setupSuperAdmin(dto: SetupSuperAdminDto) {
    const expectedSecret = this.configService.get<string>('app.superAdminSetupSecret');

    if (!expectedSecret) {
      throw new ForbiddenException(
        'Super Admin setup is disabled. Set SUPER_ADMIN_SETUP_SECRET in .env',
      );
    }

    if (dto.setupSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid setup secret');
    }

    if (await this.usersService.superAdminExists()) {
      const updated = await this.usersService.resetSuperAdminCredentials({
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        password: dto.password,
        profileImage: dto.profileImage,
      });
      return this.responseService.success(
        'Super Admin already existed, so credentials were reset successfully.',
        updated,
      );
    }

    const result = await this.usersService.create(
      {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        password: dto.password,
        role: UserRole.SUPER_ADMIN,
        profileImage: dto.profileImage,
      },
      { status: UserStatus.ACTIVE },
    );

    if (result.data) {
      const user = result.data as unknown as { _id: { toString(): string } };
      await this.usersService.verifyEmail(user._id.toString());
    }

    return this.responseService.success(
      'Super Admin created successfully. You can now login. This endpoint will not work again.',
      result.data,
    );
  }

  private async issueSessionForUser(user: UserDocument) {
    assertUserCanAuthenticate(user.status);
    await this.assertLicenseAccessForUser(user);

    const tokens = await this.tokenService.generateTokenPair(user);

    await this.usersService.updateRefreshToken(
      user._id.toString(),
      tokens.refreshTokenHash,
    );

    user.lastLogin = new Date();
    await user.save();

    const licenseNotice = user.companyId
      ? await this.licensesService.getGracePeriodNoticeForCompany(
          user.companyId.toString(),
        )
      : null;

    return this.responseService.success('Login successful', {
      ...tokens,
      user: this.sanitizeUser(user),
      ...(licenseNotice ? { licenseNotice } : {}),
    });
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const clientId = this.configService.get<string>('app.googleClientId');
    if (!clientId) {
      throw new BadRequestException(
        'Google sign-in is not configured on the server (GOOGLE_CLIENT_ID)',
      );
    }

    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,
    );
    if (!tokenRes.ok) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const payload = (await tokenRes.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
    };

    if (payload.aud !== clientId) {
      throw new UnauthorizedException('Google token audience mismatch');
    }

    const verified =
      payload.email_verified === true || payload.email_verified === 'true';
    if (!verified || !payload.email) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const user = await this.usersService.findByEmail(normalizeEmail(payload.email));
    if (!user) {
      throw new UnauthorizedException(
        'No FleetTrack account found for this Google email. Register your company or contact your admin.',
      );
    }

    return this.issueSessionForUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(normalizeEmail(dto.email));

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.passwordService.compare(
      dto.password,
      user.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSessionForUser(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    assertUserCanAuthenticate(user.status);

    await this.assertLicenseAccessForUser(user);

    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);

    if (!user.refreshTokenHash || user.refreshTokenHash !== tokenHash) {
      throw new UnauthorizedException('Refresh token revoked or invalid');
    }

    const tokens = await this.tokenService.generateTokenPair(user);

    await this.usersService.updateRefreshToken(
      user._id.toString(),
      tokens.refreshTokenHash,
    );

    return this.responseService.success('Token refreshed', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return this.responseService.success('Logged out successfully');
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    const message =
      'If an account exists with this email, a 6-digit OTP has been sent';

    if (!user) {
      return this.responseService.success(message);
    }

    const { otp, expires, hash } = this.passwordService.generateOtp();

    await this.usersService.setPasswordReset(user._id.toString(), hash, expires);

    let emailed = false;
    try {
      emailed = await this.mailService.sendPasswordResetOtp(
        user.email,
        otp,
        user.fullName,
      );
    } catch (err) {
      this.logger.error(`Password reset email failed for ${user.email}`, err);
      throw new InternalServerErrorException(
        'Could not send reset email. Please try again later.',
      );
    }

    const isDev = this.configService.get<string>('app.nodeEnv') === 'development';
    const data: Record<string, unknown> = { expiresAt: expires, emailed };

    // Dev fallback when SMTP is not configured (OTP only in logs / API, not in production)
    if (isDev && !emailed) {
      data.otp = otp;
    }

    return this.responseService.success(message, data);
  }

  async verifyResetOtp(dto: VerifyResetOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user?.passwordResetToken || !user.passwordResetExpires) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.passwordResetExpires < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    const otpHash = this.passwordService.hashToken(dto.otp);
    if (user.passwordResetToken !== otpHash) {
      throw new BadRequestException('Invalid OTP');
    }

    return this.responseService.success('OTP verified successfully');
  }

  async resetPassword(dto: ResetPasswordDto) {
    const newPassword = dto.password ?? dto.newPassword;
    if (!newPassword) {
      throw new BadRequestException('password or newPassword is required');
    }

    const tokenHash = this.passwordService.hashToken(dto.token);

    const user = dto.email
      ? await this.usersService.findByEmail(dto.email)
      : await this.usersService.findByPasswordResetToken(tokenHash);

    if (!user?.passwordResetToken || !user.passwordResetExpires) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    if (user.passwordResetToken !== tokenHash) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await this.passwordService.hash(newPassword);
    await this.usersService.updatePassword(user._id.toString(), hashedPassword);

    return this.responseService.success(
      'Password reset successful. Please login with your new password',
    );
  }

  async profile(userId: string) {
    const result = await this.usersService.findOne(userId);

    if (result.data) {
      const user = result.data as unknown as { role: string };
      return this.responseService.success('Profile fetched successfully', {
        ...JSON.parse(JSON.stringify(result.data)),
        permissions:
          user.role === UserRole.SUPPORT_ADMIN
            ? (((result.data as unknown as { permissions?: string[] }).permissions) ?? [])
            : (ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? []),
      });
    }

    return result;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const result = await this.usersService.update(userId, dto);
    return this.responseService.success('Profile updated successfully', result.data);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user?.password) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await this.passwordService.compare(dto.oldPassword, user.password);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashed = await this.passwordService.hash(dto.newPassword);
    await this.usersService.updatePassword(userId, hashed);

    return this.responseService.success('Password changed successfully');
  }

  async getPermissions(role: string) {
    return this.responseService.success('Role permissions', {
      role,
      permissions:
        ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [],
    });
  }
}
