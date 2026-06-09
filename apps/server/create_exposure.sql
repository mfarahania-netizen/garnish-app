CREATE TABLE IF NOT EXISTS "RecommendationExposure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'recommendation',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scorePenalty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    CONSTRAINT "RecommendationExposure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RecommendationExposure_userId_recipeId_viewedAt_idx" ON "RecommendationExposure"("userId", "recipeId", "viewedAt");
ALTER TABLE "RecommendationExposure" ADD CONSTRAINT "RecommendationExposure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationExposure" ADD CONSTRAINT "RecommendationExposure_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;