// apps/server/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) return null;
    // Banned → no valid principal (defense in depth; login also blocks).
    if ((user as any).isBanned) return null;
    // Stateless-JWT kick: a token minted before a force-logout / ban / admin password-reset carries a stale epoch
    // → reject it. Legacy tokens with no epoch claim compare as 0, matching the default for an un-kicked user.
    if ((payload.epoch ?? 0) !== ((user as any).sessionEpoch ?? 0)) return null;
    return {
      userId: user.id,
      phone: user.phone,
      isAdmin: user.isAdmin,
      isGuest: (user as any).isGuest ?? false,
    };
  }
}