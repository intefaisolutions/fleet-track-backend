import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '../common/enums';
import { ROLES } from '../constants/roles.constant';
import { DRIVER_SESSION_EXPIRED_MESSAGE } from '../constants/driver-session.constant';
import { UsersService } from '../users/services/users.service';
import { JwtPayload } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.accessSecret') ||
        'change-access-secret-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    let permissions: string[] | undefined;

    // Drivers: enforce 7-day inactivity logout; touch activity for active users
    if (payload.role === ROLES.DRIVER) {
      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is inactive or not found');
      }

      if (this.usersService.isDriverInactive(user)) {
        await this.usersService.updateRefreshToken(user._id.toString(), null);
        throw new UnauthorizedException(DRIVER_SESSION_EXPIRED_MESSAGE);
      }

      // Active drivers: keep lastActivity fresh (throttled) so they are not logged out
      await this.usersService.touchDriverActivityIfNeeded(user._id.toString());
    } else if (payload.role === ROLES.SUPPORT_ADMIN) {
      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is inactive or not found');
      }
      permissions = user.permissions ?? [];
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
      permissions,
    };
  }
}
