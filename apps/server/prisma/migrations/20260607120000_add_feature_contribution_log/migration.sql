-- CreateTable
CREATE TABLE "FeatureContributionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureContributionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureContributionLog_userId_recipeId_createdAt_idx" ON "FeatureContributionLog"("userId", "recipeId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureContributionLog_featureKey_contribution_idx" ON "FeatureContributionLog"("featureKey", "contribution");

-- AddForeignKey
ALTER TABLE "FeatureContributionLog" ADD CONSTRAINT "FeatureContributionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureContributionLog" ADD CONSTRAINT "FeatureContributionLog_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
