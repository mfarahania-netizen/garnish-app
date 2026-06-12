CREATE TABLE "Ingredient" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT,
  "version" TEXT,
  "batch" JSONB,
  "nameFa" TEXT,
  "nameEn" TEXT,
  "category" TEXT,
  "subCategory" TEXT,
  "ingredientState" JSONB,
  "dietFlags" JSONB,
  "allergens" JSONB,
  "nutritionPer100g" JSONB,
  "nutritionConfidence" JSONB,
  "tasteProfile" JSONB,
  "textureProfile" JSONB,
  "cookingBehavior" JSONB,
  "healthContext" JSONB,
  "substitutionOptions" JSONB,
  "media" JSONB,
  "aiContext" JSONB,
  "marketAvailability" JSONB,
  "cuisineRelevance" JSONB,
  "dataQuality" JSONB,
  "recipeInputAliases" JSONB,
  "resolverDefaults" JSONB,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ingredient_code_key" ON "Ingredient"("code");
CREATE INDEX "Ingredient_category_idx" ON "Ingredient"("category");
CREATE INDEX "Ingredient_code_idx" ON "Ingredient"("code");

ALTER TABLE "RecipeIngredient" ADD COLUMN "ingredientId" TEXT;
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");
ALTER TABLE "RecipeIngredient"
  ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey"
  FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
