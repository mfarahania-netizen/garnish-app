import { Controller, Get, Post, Body, Req, UseGuards, Delete, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MealPlansService } from './meal-plans.service';
import { MealPlanPlannerService } from './planner/meal-plan-planner.service';
import { AddMealSlotDto, SavePlanDto } from './dto/meal-plan.dto';

@Controller('meal-plans')
@UseGuards(AuthGuard('jwt'))
export class MealPlansController {
  constructor(
    private readonly mealPlansService: MealPlansService,
    private readonly planner: MealPlanPlannerService,
  ) {}

  @Get()
  getCurrentPlan(@Req() req) {
    return this.mealPlansService.getCurrentPlan(req.user.userId);
  }

  // حذف نمی‌شود، اما استفاده از آن در هوک جدید کم می‌شود
  @Post()
  savePlan(@Req() req, @Body() body: SavePlanDto) {
    return this.mealPlansService.savePlan(req.user.userId, body.weekStart, body.slots);
  }

  // ✅ جدید: افزودن یک وعده
  @Post('slots')
  addMealSlot(@Req() req, @Body() body: AddMealSlotDto) {
    return this.mealPlansService.addMealSlot(req.user.userId, body.dayOfWeek, body.mealType, body.recipeId);
  }

  // Safe dishes to MANUALLY drop into a slot (empty-slot picker). Allergy-gated; meal-fit + Persian-first; optional q.
  @Get('dish-options')
  dishOptions(@Req() req, @Query('meal') meal?: string, @Query('q') q?: string) {
    return this.mealPlansService.dishOptions(req.user.userId, meal, q);
  }

  // Mark a slot cooked / un-cooked (the "پختم" signature interaction). Body { cooked: boolean } (defaults true).
  @Post('slots/:dayOfWeek/:mealType/cooked')
  markCooked(@Req() req, @Param('dayOfWeek') dayOfWeek: string, @Param('mealType') mealType: string, @Body() body: { cooked?: boolean }) {
    return this.mealPlansService.markCooked(req.user.userId, parseInt(dayOfWeek), mealType, body?.cooked !== false);
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

  /**
   * PLANNER-L4-09: intelligent weekly plan PROPOSAL — reuses getLivingUserProfile + S07 fit, HARD-excludes
   * declared allergies, optimizes variety/effort/pantry-reuse with per-slot WHY. PROPOSES ONLY (writes
   * nothing); the user accepts via POST /meal-plans/slots (the existing apply path).
   */
  @Post('propose')
  proposePlan(@Req() req, @Body() body: { meals?: string[]; days?: number }) {
    return this.planner.proposePlan(req.user.userId, { meals: body?.meals, days: body?.days });
  }

  /**
   * FI-STEP-1.3: per-slot «یکی دیگه» — returns the next-best safe, course-valid candidate for ONE slot,
   * excluding the current dish + anything already shown for it (+ the user's recently-declined). PROPOSES
   * ONLY (writes nothing); the user accepts the swap via the existing POST /meal-plans/slots path.
   */
  @Post('slots/swap')
  swapSlot(@Req() req, @Body() body: { dayOfWeek: number; mealType: string; excludeRecipeIds?: string[] }) {
    return this.planner.swapSlot(req.user.userId, { dayOfWeek: body.dayOfWeek, mealType: body.mealType, excludeRecipeIds: body?.excludeRecipeIds });
  }
}