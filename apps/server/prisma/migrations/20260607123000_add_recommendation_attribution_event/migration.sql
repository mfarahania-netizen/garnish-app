-- CreateTable
CREATE TABLE "RecommendationAttributionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "source" TEXT NOT NULL DEFAULT 'recommendation',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationAttributionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationAttributionEvent_userId_recipeId_occurredAt_idx" ON "RecommendationAttributionEvent"("userId", "recipeId", "occurredAt");

-- CreateIndex
CREATE INDEX "RecommendationAttributionEvent_eventType_value_idx" ON "RecommendationAttributionEvent"("eventType", "value");

-- AddForeignKey
ALTER TABLE "RecommendationAttributionEvent" ADD CONSTRAINT "RecommendationAttributionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationAttributionEvent" ADD CONSTRAINT "RecommendationAttributionEvent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
