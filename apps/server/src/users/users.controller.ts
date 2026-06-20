// apps/server/src/users/users.controller.ts
import { Controller, Get, Patch, Put, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { sanitizeUser } from '../common/serializers/user.serializer';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Req() req) {
    return sanitizeUser(await this.usersService.findById(req.user.userId));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return sanitizeUser(
      await this.usersService.updateProfile(req.user.userId, dto.name, dto.email, dto.avatar),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('preferences')
  async getPreferences(@Req() req) {
    return this.usersService.getPreferences(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('preferences')
  async updatePreferences(@Req() req, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(req.user.userId, dto);
  }

  // 🆕 ثبت رضایت‌نامه GDPR
  @UseGuards(AuthGuard('jwt'))
  @Post('consent')
  async grantConsent(@Req() req, @Body() body: { type: string; granted: boolean }) {
    return this.usersService.grantConsent(req.user.userId, body.type, body.granted, req.ip);
  }

  // 🆕 GDPR Art. 20: data portability — export the CURRENT user's own data only.
  // userId is taken from the verified JWT (req.user.userId); no client-supplied id is accepted.
  @UseGuards(AuthGuard('jwt'))
  @Get('me/export')
  async exportMe(@Req() req) {
    return this.usersService.exportUser(req.user.userId);
  }

  // 🆕 Right to be Forgotten (GDPR)
  @UseGuards(AuthGuard('jwt'))
  @Delete('me')
  async deleteAccount(@Req() req) {
    const userId = req.user.userId;
    await this.usersService.deleteUser(userId);
    return { message: 'Account and all associated data permanently deleted.' };
  }
}