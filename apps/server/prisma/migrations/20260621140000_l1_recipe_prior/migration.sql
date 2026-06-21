-- CreateTable
CREATE TABLE "RecipePrior" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "n" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mean" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posterior" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "populationMu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipePrior_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipePrior_scope_scopeKey_idx" ON "RecipePrior"("scope", "scopeKey");

-- CreateIndex
CREATE INDEX "RecipePrior_recipeId_idx" ON "RecipePrior"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipePrior_recipeId_scope_scopeKey_key" ON "RecipePrior"("recipeId", "scope", "scopeKey");
