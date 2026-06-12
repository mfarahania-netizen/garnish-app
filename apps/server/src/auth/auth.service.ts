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
    // ❌ isAdmin از payload حذف شد
    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
    });
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
    // ❌ isAdmin از payload حذف شد
    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
    });
    return { token, user: sanitizeUser(user) };
  }
}