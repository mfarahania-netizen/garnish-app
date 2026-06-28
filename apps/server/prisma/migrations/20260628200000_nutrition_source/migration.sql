-- Nutrition provenance: distinguishes ESTIMATED rows (ingredient-computed: GRIS weightG × source-locked
-- per-100g ÷ servings) from future USDA source-locked / authored values. Additive + nullable → every
-- existing row (NULL = unknown/legacy provenance) and every reader stay byte-identical. No backfill here;
-- the backfill-persian-nutrition script sets 'estimated_ingredient_gris_v1' on the rows it fills.
ALTER TABLE "Nutrition" ADD COLUMN IF NOT EXISTS "source" TEXT;
