// apps/server/src/auth/auth.service.ts
import { ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { sanitizeUser } from '../common/serializers/user.serializer';
import { normalizeIranMobile } from '../common/phone-normalization';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { randomInt } from 'crypto';
import { GoogleIdTokenService } from './google-id-token.service';
import { Prisma } from '@prisma/client';

function boundedIntegerEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private sms: SmsService,
    private googleTokens: GoogleIdTokenService,
  ) {}

  private otpTtlMs() {
    return boundedIntegerEnv('OTP_TTL_SECONDS', 120, 30, 600) * 1000;
  }

  private otpCooldownMs() {
    return boundedIntegerEnv('OTP_RESEND_COOLDOWN_SECONDS', 60, 10, 600) * 1000;
  }

  private otpMaxAttempts() {
    return boundedIntegerEnv('OTP_MAX_ATTEMPTS', 5, 1, 10);
  }

  private otpDailyLimit() {
    return boundedIntegerEnv('OTP_DAILY_LIMIT_PER_PHONE', 10, 1, 50);
  }

  private otpRequestAcceptedResponse() {
    return {
      ok: true,
      ttlSeconds: Math.floor(this.otpTtlMs() / 1000),
      resendCooldownSeconds: Math.floor(this.otpCooldownMs() / 1000),
      message: 'کد ورود برای شما ارسال شد.',
    };
  }

  private issueToken(user: any) {
    const token = this.jwtService.sign({
      sub: user.id,
      epoch: user.sessionEpoch ?? 0,
    });
    return { token, user: sanitizeUser(user) };
  }

  private async verifiedUserForClient(user: any) {
    if (!user?.id || typeof (this.usersService as any).findById !== 'function') return user;
    return (await this.usersService.findById(user.id)) || user;
  }

  async register(phone: string, password: string, name?: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const existing = await this.usersService.findByPhone(normalizedPhone);
    if (existing) throw new UnauthorizedException('این شماره قبلاً ثبت شده است');
    const user = await this.usersService.createUser(normalizedPhone, password, name);
    // Optional user-linked funnel analytics stays off until the user grants the analytics purpose.
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
      // Keep account state private. A banned phone receives the same public
      // acknowledgement as every other number, while no OTP row or SMS is
      // created. Verification remains independently fail-closed.
      return this.otpRequestAcceptedResponse();
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
    let otp: { id: string };
    try {
      otp = await this.prisma.$transaction(async (tx) => {
        // Repeat both limits inside a Serializable transaction. The fast reads
        // above avoid needless bcrypt work for obvious rejects; these canonical
        // reads close concurrent-tab and multi-instance check/create races.
        const canonicalDailyCount = await tx.authOtpCode.count({
          where: { phone: normalizedPhone, purpose: 'login', createdAt: { gte: dailySince } },
        });
        if (canonicalDailyCount >= this.otpDailyLimit()) {
          throw new ForbiddenException('otp_daily_limit_reached');
        }
        const canonicalRecent = await tx.authOtpCode.findFirst({
          where: {
            phone: normalizedPhone,
            purpose: 'login',
            createdAt: { gte: new Date(now.getTime() - this.otpCooldownMs()) },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (canonicalRecent) throw new ForbiddenException('otp_resend_cooldown');

        return tx.authOtpCode.create({
          data: {
            userId: user?.id ?? null,
            phone: normalizedPhone,
            codeHash,
            purpose: 'login',
            expiresAt: new Date(now.getTime() + this.otpTtlMs()),
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2034') throw new ForbiddenException('otp_resend_cooldown');
      throw error;
    }
    try {
      await this.sms.sendOtpCode(normalizedPhone, code);
    } catch (error) {
      await this.prisma.authOtpCode.delete({ where: { id: otp.id } }).catch(() => {});
      throw error;
    }
    // Only retire the prior code after the provider accepted the new SMS. If
    // sending fails, deleting the unsent row leaves the previous live code
    // usable instead of locking the user out.
    try {
      await this.prisma.authOtpCode.updateMany({
        where: { phone: normalizedPhone, purpose: 'login', consumedAt: null, id: { not: otp.id } },
        data: { consumedAt: new Date() },
      });
    } catch {
      // The provider has already accepted the new code, so surfacing a 500 here
      // would strand the client on the phone step while the valid OTP is under
      // cooldown. Verification always selects the newest live OTP; retirement
      // is therefore best-effort and the failure is logged without PII/secrets.
      this.logger.warn('Failed to retire prior login OTP codes after SMS acceptance');
    }
    return this.otpRequestAcceptedResponse();
  }

  async verifyOtp(phone: string, code: string, name?: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const now = new Date();
    const otp = await this.prisma.authOtpCode.findFirst({
      where: {
        phone: normalizedPhone,
        purpose: 'login',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= this.otpMaxAttempts()) {
      throw new UnauthorizedException('کد ورود معتبر نیست یا منقضی شده است.');
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      // Keep the attempt budget atomic. Concurrent wrong guesses must not race
      // past the configured maximum, revive an expired code, or mutate a code
      // that another request has already consumed.
      await this.prisma.authOtpCode.updateMany({
        where: {
          id: otp.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: this.otpMaxAttempts() },
        },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('کد ورود معتبر نیست یا منقضی شده است.');
    }

    // bcrypt deliberately stays outside the transaction. The conditional
    // update below is the atomic claim: only one concurrent verifier can move
    // this still-live, under-budget OTP from unconsumed to consumed. All user
    // mutations live in the same transaction, so a failed account write rolls
    // the claim back and can never burn a valid code halfway through login.
    const result = await this.prisma.$transaction(async (tx) => {
      const claimedAt = new Date();
      const claim = await tx.authOtpCode.updateMany({
        where: {
          id: otp.id,
          phone: normalizedPhone,
          purpose: 'login',
          consumedAt: null,
          expiresAt: { gt: claimedAt },
          attempts: { lt: this.otpMaxAttempts() },
        },
        data: { consumedAt: claimedAt },
      });
      if (claim.count !== 1) {
        throw new UnauthorizedException('کد ورود معتبر نیست یا منقضی شده است.');
      }

      const existingUser = await tx.user.findUnique({ where: { phone: normalizedPhone } });
      if (existingUser?.isBanned) {
        throw new UnauthorizedException('حساب شما مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.');
      }
      const claimingUnverifiedExistingPhone = Boolean(
        existingUser && !existingUser.phoneVerifiedAt,
      );

      // Native upsert closes the phone-unique creation race with another auth
      // flow. Only the OTP claimant reaches this point; an independently
      // created account is adopted without exposing a P2002/500 to the client.
      let updatedUser = await tx.user.upsert({
        where: { phone: normalizedPhone },
        create: {
          phone: normalizedPhone,
          phoneVerifiedAt: claimedAt,
          password: null,
          isGuest: false,
          name: name?.trim() || undefined,
        },
        update: {
          isGuest: false,
          deviceKey: null,
          phoneVerifiedAt: claimedAt,
          ...(claimingUnverifiedExistingPhone
            ? { password: null, sessionEpoch: { increment: 1 } }
            : {}),
        },
      });
      // If a legacy password registration inserted this phone after the
      // pre-upsert lookup but before the upsert, the update branch returns a
      // password even though existingUser was null. Claim it in the same
      // transaction and invalidate the attacker's already-issued JWT epoch.
      if (!existingUser && updatedUser.password) {
        updatedUser = await tx.user.update({
          where: { id: updatedUser.id },
          data: { password: null, sessionEpoch: { increment: 1 } },
        });
      }
      await tx.authOtpCode.updateMany({
        where: { phone: normalizedPhone, purpose: 'login', consumedAt: null, id: { not: otp.id } },
        data: { consumedAt: claimedAt },
      });
      return { user: updatedUser, created: existingUser == null };
    });

    return {
      ...this.issueToken(await this.verifiedUserForClient(result.user)),
      created: result.created,
    };
  }

  async googleLogin(credential: string) {
    const profile = await this.googleTokens.verifyCredential(credential);
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        // User.email is currently editable without an email-verification
        // ceremony. Auto-linking on that field lets one account pre-claim a
        // victim's Google email. Linking must therefore require a separately
        // authenticated account-link flow; never mutate or issue a token here.
        throw new ConflictException({
          code: 'google_account_link_required',
          message: 'این ایمیل از قبل روی یک حساب است؛ ابتدا با روش قبلی وارد شوید و سپس گوگل را متصل کنید.',
        });
      }

      try {
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
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;

        // Two callbacks for the same verified Google subject may race on a
        // cold account. The unique googleId winner is safe to reuse; an email
        // collision without that exact subject remains fail-closed.
        user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
        if (!user) {
          throw new ConflictException({
            code: 'google_account_link_required',
            message: 'این ایمیل از قبل روی یک حساب است؛ ابتدا با روش قبلی وارد شوید و سپس گوگل را متصل کنید.',
          });
        }
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

    return this.issueToken(await this.verifiedUserForClient(user));
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
