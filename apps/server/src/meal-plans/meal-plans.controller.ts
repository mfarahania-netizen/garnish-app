import { Controller, Get, Post, Body, Req, UseGuards, Delete, Param } from '@nestjs/common';
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

  // حذف نمی‌شود، اما استفاده از آن در هوک جدید کم می‌شود
  @Post()
  savePlan(@Req() req, @Body() body: { weekStart: string; slots: any[] }) {
    return this.mealPlansService.savePlan(req.user.userId, body.weekStart, body.slots);
  }

  // ✅ جدید: افزودن یک وعده
  @Post('slots')
  addMealSlot(@Req() req, @Body() body: { dayOfWeek: number; mealType: string; recipeId: string }) {
    return this.mealPlansService.addMealSlot(req.user.userId, body.dayOfWeek, body.mealType, body.recipeId);
  }

  // ✅ جدید: حذف یک وعده
  @Delete('slots/:dayOfWeek/:mealType')
  removeMealSlot(
    @Req() req,
    @Param('dayOfWeek') dayOfWeek: string,
    @Param('mealType') mealType: string,
  ) {
    return this.mealPlansService.removeMealSlot(req.user.userId, parseInt(dayOfWeek), mealType);
  }

  @Post('generate')
  generatePlan(@Req() req) {
    return this.mealPlansService.generateSmartPlan(req.user.userId);
  }
}