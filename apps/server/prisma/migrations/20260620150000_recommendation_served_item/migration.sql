-- L0/L1 foundation: the served-slate log ("counters first-class"). Captures position + propensity for every
-- recommendation served, so off-policy / counterfactual learning (IPS) has unbiased data from day one.
-- Additive new table; no FK (matches RecommendationShadowTrace) to keep the serve hot path lean.
CREATE TABLE IF NOT EXISTS "RecommendationServedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "propensity" DOUBLE PRECISION NOT NULL,
    "surface" TEXT,
    "contextJson" TEXT,
    "sessionId" TEXT,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationServedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecommendationServedItem_userId_servedAt_idx" ON "RecommendationServedItem" ("userId", "servedAt");
CREATE INDEX IF NOT EXISTS "RecommendationServedItem_recipeId_servedAt_idx" ON "RecommendationServedItem" ("recipeId", "servedAt");
