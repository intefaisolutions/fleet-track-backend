import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthTokens, JwtPayload, TokenType } from '../../types';
import { UserDocument } from '../../users/schemas/user.schema';
import { PasswordService } from './password.service';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  private buildPayload(user: UserDocument, type: TokenType): JwtPayload {
    return {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
      type,
    };
  }

  async generateTokenPair(user: UserDocument): Promise<AuthTokens & { refreshTokenHash: string }> {
    const accessPayload = this.buildPayload(user, 'access');
    const refreshPayload = this.buildPayload(user, 'refresh');

    const accessSecret = this.configService.get<string>('jwt.accessSecret')!;
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret')!;
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') || '24h';
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    const refreshTokenHash = this.passwordService.hashToken(refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshTokenHash,
    };
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  hashRefreshToken(token: string): string {
    return this.passwordService.hashToken(token);
  }
}
