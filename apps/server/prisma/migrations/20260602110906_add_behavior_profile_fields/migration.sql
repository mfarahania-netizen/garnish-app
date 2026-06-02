-- AlterTable
ALTER TABLE "UserBehaviorProfile" ADD COLUMN     "budgetScore" TEXT,
ADD COLUMN     "cookingFrequency" TEXT,
ADD COLUMN     "dislikedIngredients" TEXT DEFAULT '[]',
ADD COLUMN     "favoriteIngredients" TEXT DEFAULT '[]',
ADD COLUMN     "healthAdherenceScore" DOUBLE PRECISION,
ADD COLUMN     "preferredMealTimes" TEXT DEFAULT '{}',
ADD COLUMN     "weeklyPatterns" TEXT DEFAULT '{}';
