import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MealPlansService } from './meal-plans.service';

@Controller('meal-plans')
@UseGuards(AuthGuard('jwt'))
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Get()
  getCurrentPlan(@Req() req) {
    return this.mealPlansService.getCurrentPlan(req.user.userId);
  }

  @Post()
  savePlan(@Req() req, @Body() body: { weekStart: string; slots: any[] }) {
    return this.mealPlansService.savePlan(req.user.userId, body.weekStart, body.slots);
  }

  @Post('generate')
  generatePlan(@Req() req) {
    return this.mealPlansService.generateSmartPlan(req.user.userId);
  }
}