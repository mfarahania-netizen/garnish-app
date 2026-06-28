-- Add cookedAt to MealSlot (the "پختم" / mark-cooked signature interaction). Additive + nullable → safe.
ALTER TABLE "MealSlot" ADD COLUMN IF NOT EXISTS "cookedAt" TIMESTAMP(3);
