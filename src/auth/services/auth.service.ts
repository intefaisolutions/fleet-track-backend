import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { SetupSuperAdminDto } from '../dto/setup-super-admin.dto';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly responseService: ResponseService,
  ) {}

  private sanitizeUser(user: UserDocument) {
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
      permissions:
        ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? [],
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

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

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

    assertUserCanAuthenticate(user.status);

    const tokens = await this.tokenService.generateTokenPair(user);

    await this.usersService.updateRefreshToken(
      user._id.toString(),
      tokens.refreshTokenHash,
    );

    user.lastLogin = new Date();
    await user.save();

    return this.responseService.success('Login successful', {
      ...tokens,
      user: this.sanitizeUser(user),
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    assertUserCanAuthenticate(user.status);

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
      'If an account exists with this email, a password reset link has been sent';

    if (!user) {
      return this.responseService.success(message);
    }

    const { token, expires, hash } = this.passwordService.generateResetToken();

    await this.usersService.setPasswordReset(user._id.toString(), hash, expires);

    const isDev = this.configService.get<string>('app.nodeEnv') === 'development';
    const data: Record<string, unknown> = { expiresAt: expires };

    if (isDev) {
      data.resetToken = token;
      data.resetUrl = `${this.configService.get<string>('app.baseUrl')}/reset-password?token=${token}&email=${encodeURIComponent(dto.email)}`;
    }

    return this.responseService.success(message, data);
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
          ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? [],
      });
    }

    return result;
  }

  async getPermissions(role: string) {
    return this.responseService.success('Role permissions', {
      role,
      permissions:
        ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [],
    });
  }
}
