import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GuestDto } from './dto/guest.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'; // ← ThrottlerGuard اضافه شد

@Controller('auth')
@UseGuards(ThrottlerGuard) // ← گارد محدودیت نرخ فقط روی این کنترلر فعال می‌شود
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.phone, body.password, body.name);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.phone, body.password);
  }

  // Onboarding v1 — silent passwordless guest session (rate-limited; resumes by deviceKey). No PII.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('guest')
  guest(@Body() body: GuestDto) {
    return this.authService.guestSession(body.deviceKey);
  }
}