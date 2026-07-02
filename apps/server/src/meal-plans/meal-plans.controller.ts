import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MealPlansService } from './meal-plans.service';
import { MealPlanPlannerService } from './planner/meal-plan-planner.service';
import { AddMealSlotDto, SavePlanDto } from './dto/meal-plan.dto';
import { AuthenticatedRequest } from '../auth/authenticated-request.interface';

// parse + clamp the ?offset query (weeks from the current week; 0=this week) to a sane ±8-week window so a crafted value
// can't probe far-off weeks. Non-numeric → current week.
const weekOffset = (v?: string): number => {
  const n = parseInt(v ?? '0', 10);
  return Number.isFinite(n) ? Math.max(-8, Math.min(8, n)) : 0;
};

@Controller('meal-plans')
@UseGuards(AuthGuard('jwt'))
export class MealPlansController {
  constructor(
    private readonly mealPlansService: MealPlansService,
    private readonly planner: MealPlanPlannerService,
  ) {}

  @Get()
  getCurrentPlan(
    @Req() req: AuthenticatedRequest,
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.getCurrentPlan(
      req.user.userId,
      weekOffset(offset),
    );
  }

  // حذف نمی‌شود، اما استفاده از آن در هوک جدید کم می‌شود
  @Post()
  savePlan(@Req() req: AuthenticatedRequest, @Body() body: SavePlanDto) {
    return this.mealPlansService.savePlan(
      req.user.userId,
      body.weekStart,
      body.slots,
    );
  }

  // ✅ جدید: افزودن یک وعده
  @Post('slots')
  addMealSlot(
    @Req() req: AuthenticatedRequest,
    @Body() body: AddMealSlotDto,
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.addMealSlot(
      req.user.userId,
      body.dayOfWeek,
      body.mealType,
      body.recipeId,
      weekOffset(offset),
    );
  }

  // Safe dishes to MANUALLY drop into a slot (empty-slot picker). Allergy-gated; meal-fit + Persian-first; optional q.
  @Get('dish-options')
  dishOptions(
    @Req() req: AuthenticatedRequest,
    @Query('meal') meal?: string,
    @Query('q') q?: string,
  ) {
    return this.mealPlansService.dishOptions(req.user.userId, meal, q);
  }

  // Mark a slot cooked / un-cooked (the "پختم" signature interaction). Body { cooked: boolean } (defaults true).
  @Post('slots/:dayOfWeek/:mealType/cooked')
  markCooked(
    @Req() req: AuthenticatedRequest,
    @Param('dayOfWeek') dayOfWeek: string,
    @Param('mealType') mealType: string,
    @Body() body: { cooked?: boolean },
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.markCooked(
      req.user.userId,
      parseInt(dayOfWeek),
      mealType,
      body?.cooked !== false,
      weekOffset(offset),
    );
  }

  // Copy a whole week's slots to another week (?from & ?to are week offsets). The repeat-use lever ("next week = this week").
  @Post('copy')
  copyWeek(
    @Req() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.mealPlansService.copyWeek(
      req.user.userId,
      weekOffset(from),
      weekOffset(to),
    );
  }

  // Set how many people a slot is cooked for (scales the shopping list). Body { servings: number } (0/absent → recipe base).
  @Post('slots/:dayOfWeek/:mealType/servings')
  setServings(
    @Req() req: AuthenticatedRequest,
    @Param('dayOfWeek') dayOfWeek: string,
    @Param('mealType') mealType: string,
    @Body() body: { servings?: number },
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.setServings(
      req.user.userId,
      parseInt(dayOfWeek),
      mealType,
      Number(body?.servings),
      weekOffset(offset),
    );
  }

  // Clear every meal of the viewed week (?offset). The «پاک‌کردنِ این هفته» action.
  @Post('clear-week')
  clearWeek(
    @Req() req: AuthenticatedRequest,
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.clearWeek(req.user.userId, weekOffset(offset));
  }

  // ✅ جدید: حذف یک وعده
  @Delete('slots/:dayOfWeek/:mealType')
  removeMealSlot(
    @Req() req: AuthenticatedRequest,
    @Param('dayOfWeek') dayOfWeek: string,
    @Param('mealType') mealType: string,
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.removeMealSlot(
      req.user.userId,
      parseInt(dayOfWeek),
      mealType,
      weekOffset(offset),
    );
  }

  @Post('generate')
  generatePlan(
    @Req() req: AuthenticatedRequest,
    @Query('offset') offset?: string,
  ) {
    return this.mealPlansService.generateSmartPlan(
      req.user.userId,
      weekOffset(offset),
    );
  }

  /**
   * PLANNER-L4-09: intelligent weekly plan PROPOSAL — reuses getLivingUserProfile + S07 fit, HARD-excludes
   * declared allergies, optimizes variety/effort/pantry-reuse with per-slot WHY. PROPOSES ONLY (writes
   * nothing); the user accepts via POST /meal-plans/slots (the existing apply path).
   */
  @Post('propose')
  proposePlan(
    @Req() req: AuthenticatedRequest,
    @Body() body: { meals?: string[]; days?: number },
  ) {
    return this.planner.proposePlan(req.user.userId, {
      meals: body?.meals,
      days: body?.days,
    });
  }

  /**
   * FI-STEP-1.3: per-slot «یکی دیگه» — returns the next-best safe, course-valid candidate for ONE slot,
   * excluding the current dish + anything already shown for it (+ the user's recently-declined). PROPOSES
   * ONLY (writes nothing); the user accepts the swap via the existing POST /meal-plans/slots path.
   */
  @Post('slots/swap')
  swapSlot(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { dayOfWeek: number; mealType: string; excludeRecipeIds?: string[] },
  ) {
    return this.planner.swapSlot(req.user.userId, {
      dayOfWeek: body.dayOfWeek,
      mealType: body.mealType,
      excludeRecipeIds: body?.excludeRecipeIds,
    });
  }
}
