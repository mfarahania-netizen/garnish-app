// apps/server/src/users/users.controller.ts
import { Controller, Get, Patch, Put, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto.name, dto.email, dto.avatar);
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
    return this.usersService.grantConsent(req.user.userId, body.type, body.granted);
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