import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Meal-plan write DTOs (audit P1): these routes were typed with inline TS interfaces, so the global ValidationPipe
 * did nothing — a client could POST 100k slots (DB-bloat / DoS) or an out-of-range dayOfWeek / 10KB mealType straight
 * to the DB. These bound the size + range. mealType is length-capped (not enum-checked) because both Persian
 * («شام») and English («dinner») values are valid in the current data; the planner normalizes downstream.
 */

const MAX_SLOTS = 60; // 7 days × ~8 meal contexts — generous, but not unbounded

export class AddMealSlotDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() @MaxLength(24) mealType: string;
  @IsString() @MaxLength(40) recipeId: string;
}

export class MealSlotDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() @MaxLength(24) mealType: string;
  @IsOptional() @IsString() @MaxLength(40) recipeId?: string;
  @IsOptional() @IsString() @MaxLength(280) notes?: string;
}

export class SavePlanDto {
  @IsString() @MaxLength(40) weekStart: string;
  @IsArray() @ArrayMaxSize(MAX_SLOTS) @ValidateNested({ each: true }) @Type(() => MealSlotDto) slots: MealSlotDto[];
}
