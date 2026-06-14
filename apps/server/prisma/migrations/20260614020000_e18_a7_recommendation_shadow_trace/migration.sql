-- E18/E43-A7: additive redacted shadow recommendation trace table.
-- Purely additive (new table, no FK, no changes to existing tables, no backfill). Default writes are OFF
-- (env-gated). Stores ONLY redacted/minimized shadow comparison data.

-- CreateTable
CREATE TABLE "RecommendationShadowTrace" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "experimentKey" TEXT,
    "liveFingerprint" TEXT NOT NULL,
    "shadowFingerprint" TEXT NOT NULL,
    "topKOverlap" DOUBLE PRECISION,
    "rankShiftCount" INTEGER,
    "majorDivergence" BOOLEAN NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationShadowTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationShadowTrace_userId_idx" ON "RecommendationShadowTrace"("userId");

-- CreateIndex
CREATE INDEX "RecommendationShadowTrace_experimentKey_idx" ON "RecommendationShadowTrace"("experimentKey");

-- CreateIndex
CREATE INDEX "RecommendationShadowTrace_createdAt_idx" ON "RecommendationShadowTrace"("createdAt");
