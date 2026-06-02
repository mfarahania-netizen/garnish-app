import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  async validate(payload: any) {
    // پیدا کردن کاربر از روی `sub` که همان userId است
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, isAdmin: true },
    });

    // اگر کاربر وجود نداشت، احراز هویت ناموفق خواهد بود
    if (!user) return null;

    // این ساختار با تمام سرویس‌های قدیمی که از `req.user.userId` استفاده می‌کنند سازگار است
    return {
      userId: user.id,
      phone: user.phone,
      isAdmin: user.isAdmin,
    };
  }
}