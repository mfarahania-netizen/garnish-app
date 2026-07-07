import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { GuestDto } from './dto/guest.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
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

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('otp/request')
  requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body.phone);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/verify')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.phone, body.code, body.name);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  google(@Body() body: GoogleAuthDto) {
    return this.authService.googleLogin(body.credential);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('password-reset/request')
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body.phone);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(body.phone, body.code, body.newPassword);
  }

  // Onboarding v1 — silent passwordless guest session (rate-limited; resumes by deviceKey). No PII.
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('guest')
  guest(@Body() body: GuestDto) {
    return this.authService.guestSession(body.deviceKey);
  }
}
