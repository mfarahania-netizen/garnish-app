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
    // گرفتن کاربر از دیتابیس
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      return null; // کاربر وجود نداشته باشه → غیرمجاز
    }
    return {
      userId: user.id,
      phone: user.phone,
      isAdmin: user.isAdmin,   // 👈 مستقیماً از دیتابیس
    };
  }
}