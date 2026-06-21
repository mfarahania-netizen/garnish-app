// apps/server/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { sanitizeUser } from '../common/serializers/user.serializer';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(phone: string, password: string, name?: string) {
    const existing = await this.usersService.findByPhone(phone);
    if (existing) throw new UnauthorizedException('این شماره قبلاً ثبت شده است');
    const user = await this.usersService.createUser(phone, password, name);
    // ❌ isAdmin از payload حذف شد. ❌ phone هم حذف شد — JWT payload فقط base64 است (نه رمز)، و data-minimization
    // برای GDPR یعنی PII (شماره) داخل تُوکنِ کلاینت نباشد. jwt.strategy کاربر را با sub از DB می‌خوانَد.
    const token = this.jwtService.sign({
      sub: user.id,
    });
    return { token, user: sanitizeUser(user) };
  }

  /**
   * Onboarding v1 — silent GUEST session. Mints (or resumes by deviceKey) a real guest User and returns a normal
   * JWT (sub only), so every visitor carries a userId and hits the server-side safeIds allergy gate. No phone, no
   * password, no PII. Rate-limited by the controller's ThrottlerGuard. The guest is later CLAIMED into a real
   * account (additive + allergy-preserving) — a separate step.
   */
  async guestSession(deviceKey?: string) {
    const user = await this.usersService.findOrCreateGuest(deviceKey);
    const token = this.jwtService.sign({ sub: user.id });
    return { token, user: sanitizeUser(user) };
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
    // ❌ isAdmin از payload حذف شد. ❌ phone هم حذف شد — JWT payload فقط base64 است (نه رمز)، و data-minimization
    // برای GDPR یعنی PII (شماره) داخل تُوکنِ کلاینت نباشد. jwt.strategy کاربر را با sub از DB می‌خوانَد.
    const token = this.jwtService.sign({
      sub: user.id,
    });
    return { token, user: sanitizeUser(user) };
  }
}