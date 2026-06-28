-- Ingredient amount→gram conversion layer (the missing connector that lets the engine compute a whole
-- dish's macros on the fly). Stores, per dictionary ingredient, the grams for each non-mass unit the recipe
-- corpus actually uses («عدد»، «پیمانه»، «قاشق غذاخوری»، «حبه» …) — mined from the corpus (GRIS weightG ÷
-- authored amount) and/or a documented culinary reference, each entry source- + confidence-flagged. ESTIMATED
-- until USDA portion-locked, exactly like Nutrition.source. Additive + nullable → every existing row (NULL =
-- no conversion data yet) and every reader stay byte-identical. No backfill here; the
-- backfill-ingredient-gram-conversions script populates it.
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "gramConversions" JSONB;
