// apps/server/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { sanitizeUser } from '../common/serializers/user.serializer';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async register(phone: string, password: string, name?: string) {
    const existing = await this.usersService.findByPhone(phone);
    if (existing) throw new UnauthorizedException('این شماره قبلاً ثبت شده است');
    const user = await this.usersService.createUser(phone, password, name);
    // Funnel anchor: a real `register` event so the onboarding funnel measures real signups (fire-and-forget; never blocks signup).
    this.prisma.userEvent.create({ data: { userId: user.id, type: 'register' } }).catch(() => {});
    // ❌ isAdmin/phone از payload حذف شد (data-minimization؛ jwt.strategy کاربر را با sub از DB می‌خوانَد).
    // epoch: کلیدِ ابطالِ توکن — هنگام force-logout/ban/reset عوض می‌شود تا توکن‌های قبلی باطل شوند.
    const token = this.jwtService.sign({
      sub: user.id,
      epoch: (user as any).sessionEpoch ?? 0,
    });
    return { token, user: sanitizeUser(user) };
  }

  /**
   * Onboarding v1 — silent GUEST session. Mints (or resumes by a server-issued deviceKey) a real guest User and
   * returns a JWT (sub only, no PII). The deviceKey is returned at the TOP LEVEL (sanitizeUser deliberately strips
   * it from `user`) so ONLY the owning client receives its own resume secret to persist. The guest token is short-
   * lived (24h vs the registered 7d) — a smaller blast radius for a credential minted for every visitor; the client
   * refreshes it by resuming with the deviceKey. Rate-limited by the controller's ThrottlerGuard. Claimed into a
   * real account (additive + allergy-preserving) — a separate step.
   */
  async guestSession(deviceKey?: string) {
    const user = await this.usersService.findOrCreateGuest(deviceKey);
    const token = this.jwtService.sign({ sub: user.id, epoch: (user as any).sessionEpoch ?? 0 }, { expiresIn: '24h' });
    return { token, user: sanitizeUser(user), deviceKey: (user as any).deviceKey as string };
  }

  async login(phone: string, password: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user || !user.password) {
      throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    }
    // مسدودشده → ورود ممنوع (jwt.strategy هم در هر درخواست رد می‌کند؛ این پیامِ روشن می‌دهد).
    if ((user as any).isBanned) {
      throw new UnauthorizedException('حساب شما مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.');
    }
    // ❌ isAdmin/phone از payload حذف شد (data-minimization). epoch: کلیدِ ابطالِ توکن (force-logout/ban/reset).
    const token = this.jwtService.sign({
      sub: user.id,
      epoch: (user as any).sessionEpoch ?? 0,
    });
    return { token, user: sanitizeUser(user) };
  }
}