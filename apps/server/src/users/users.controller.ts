import { Controller, Get, Patch, Put, Body, Req, UseGuards } from '@nestjs/common';
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
    return this.usersService.updateProfile(req.user.userId, dto.name);
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
}