-- Per-slot servings → scales the shopping list. Additive + nullable → safe.
ALTER TABLE "MealSlot" ADD COLUMN IF NOT EXISTS "servings" INTEGER;
