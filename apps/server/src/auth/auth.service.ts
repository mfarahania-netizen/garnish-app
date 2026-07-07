// apps/server/src/auth/auth.service.ts
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { sanitizeUser } from '../common/serializers/user.serializer';
import { normalizeIranMobile } from '../common/phone-normalization';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { randomInt } from 'crypto';
import { GoogleIdTokenService } from './google-id-token.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private sms: SmsService,
    private googleTokens: GoogleIdTokenService,
  ) {}

  private otpTtlMs() {
    return Math.max(30, Number(process.env.OTP_TTL_SECONDS || 120)) * 1000;
  }

  private otpCooldownMs() {
    return Math.max(10, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60)) * 1000;
  }

  private otpMaxAttempts() {
    return Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS || 5));
  }

  private otpDailyLimit() {
    return Math.max(1, Number(process.env.OTP_DAILY_LIMIT_PER_PHONE || 10));
  }

  private issueToken(user: any) {
    const token = this.jwtService.sign({
      sub: user.id,
      epoch: user.sessionEpoch ?? 0,
    });
    return { token, user: sanitizeUser(user) };
  }

  async register(phone: string, password: string, name?: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const existing = await this.usersService.findByPhone(normalizedPhone);
    if (existing) throw new UnauthorizedException('این شماره قبلاً ثبت شده است');
    const user = await this.usersService.createUser(normalizedPhone, password, name);
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
    if (String(process.env.ENABLE_GUEST_AUTH || '').toLowerCase() !== 'true') {
      throw new ForbiddenException('guest_auth_disabled');
    }
    const user = await this.usersService.findOrCreateGuest(deviceKey);
    const token = this.jwtService.sign({ sub: user.id, epoch: (user as any).sessionEpoch ?? 0 }, { expiresIn: '24h' });
    return { token, user: sanitizeUser(user), deviceKey: (user as any).deviceKey as string };
  }

  async login(phone: string, password: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const user = await this.usersService.findByPhone(normalizedPhone);
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

  async requestOtp(phone: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const now = new Date();
    const user = await this.usersService.findByPhone(normalizedPhone);
    if (user && (user as any).isBanned) {
      throw new UnauthorizedException('حساب شما مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.');
    }

    const dailySince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = await this.prisma.authOtpCode.count({
      where: { phone: normalizedPhone, purpose: 'login', createdAt: { gte: dailySince } },
    });
    if (dailyCount >= this.otpDailyLimit()) {
      throw new ForbiddenException('otp_daily_limit_reached');
    }

    const recent = await this.prisma.authOtpCode.findFirst({
      where: { phone: normalizedPhone, purpose: 'login', createdAt: { gte: new Date(Date.now() - this.otpCooldownMs()) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new ForbiddenException('otp_resend_cooldown');
    }

    const code = String(randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const otp = await this.prisma.$transaction(async (tx) => {
      await tx.authOtpCode.updateMany({
        where: { phone: normalizedPhone, purpose: 'login', consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.authOtpCode.create({
        data: {
          userId: user?.id ?? null,
          phone: normalizedPhone,
          codeHash,
          purpose: 'login',
          expiresAt: new Date(Date.now() + this.otpTtlMs()),
        },
      });
    });
    try {
      await this.sms.sendOtpCode(normalizedPhone, code);
    } catch (error) {
      await this.prisma.authOtpCode.delete({ where: { id: otp.id } }).catch(() => {});
      throw error;
    }
    return {
      ok: true,
      ttlSeconds: Math.floor(this.otpTtlMs() / 1000),
      resendCooldownSeconds: Math.floor(this.otpCooldownMs() / 1000),
      message: 'کد ورود برای شما ارسال شد.',
    };
  }

  async verifyOtp(phone: string, code: string, name?: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const otp = await this.prisma.authOtpCode.findFirst({
      where: {
        phone: normalizedPhone,
        purpose: 'login',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= this.otpMaxAttempts()) {
      throw new UnauthorizedException('کد ورود معتبر نیست یا منقضی شده است.');
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      await this.prisma.authOtpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('کد ورود معتبر نیست یا منقضی شده است.');
    }

    let user = await this.usersService.findByPhone(normalizedPhone);
    let created = false;
    if (!user) {
      user = await this.usersService.createPasswordlessUser(normalizedPhone, name?.trim() || undefined);
      created = true;
      this.prisma.userEvent.create({ data: { userId: user.id, type: 'register' } }).catch(() => {});
    }
    if ((user as any).isBanned) {
      throw new UnauthorizedException('حساب شما مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { isGuest: false, deviceKey: null },
      });
      await tx.authOtpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      await tx.authOtpCode.updateMany({
        where: { phone: normalizedPhone, purpose: 'login', consumedAt: null, id: { not: otp.id } },
        data: { consumedAt: new Date() },
      });
      return updatedUser;
    });

    return { ...this.issueToken(result), created };
  }

  async googleLogin(credential: string) {
    const profile = await this.googleTokens.verifyCredential(credential);
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: profile.googleId,
            authProvider: existingByEmail.authProvider || 'google',
            isGuest: false,
            deviceKey: null,
            name: existingByEmail.name || profile.name || null,
            avatar: existingByEmail.avatar || profile.picture || null,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            googleId: profile.googleId,
            authProvider: 'google',
            email: profile.email,
            name: profile.name || null,
            avatar: profile.picture || null,
            password: null,
            isGuest: false,
          },
        });
        this.prisma.userEvent.create({ data: { userId: user.id, type: 'register' } }).catch(() => {});
      }
    }

    if ((user as any).isBanned) {
      throw new UnauthorizedException('حساب شما مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.');
    }
    if ((user as any).isGuest) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isGuest: false, deviceKey: null, authProvider: (user as any).authProvider || 'google' },
      });
    }

    return this.issueToken(user);
  }

  async requestPasswordReset(phone: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const user = await this.usersService.findByPhone(normalizedPhone);

    if (user && !user.isGuest) {
      const recent = await this.prisma.passwordResetCode.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      });
      if (recent === 0) {
        const code = String(randomInt(100000, 1000000));
        const codeHash = await bcrypt.hash(code, 10);
        await this.prisma.passwordResetCode.create({
          data: {
            userId: user.id,
            phone: normalizedPhone,
            codeHash,
            expiresAt: new Date(Date.now() + 10 * 60_000),
          },
        });
        await this.sms.sendPasswordResetCode(normalizedPhone, code);
      }
    }

    return { ok: true, message: 'اگر این شماره ثبت شده باشد، کد بازیابی برایش ارسال می‌شود.' };
  }

  async confirmPasswordReset(phone: string, code: string, newPassword: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const user = await this.usersService.findByPhone(normalizedPhone);
    if (!user || user.isGuest) throw new UnauthorizedException('کد بازیابی معتبر نیست یا منقضی شده است.');

    const reset = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        phone: normalizedPhone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset || reset.attempts >= 5) throw new UnauthorizedException('کد بازیابی معتبر نیست یا منقضی شده است.');

    const matches = await bcrypt.compare(code, reset.codeHash);
    if (!matches) {
      await this.prisma.passwordResetCode.update({
        where: { id: reset.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('کد بازیابی معتبر نیست یا منقضی شده است.');
    }

    const password = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password, sessionEpoch: { increment: 1 } },
      }),
      this.prisma.passwordResetCode.update({
        where: { id: reset.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.passwordResetCode.updateMany({
        where: { userId: user.id, consumedAt: null, id: { not: reset.id } },
        data: { consumedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'رمز عبور با موفقیت تغییر کرد. حالا وارد شوید.' };
  }
}
