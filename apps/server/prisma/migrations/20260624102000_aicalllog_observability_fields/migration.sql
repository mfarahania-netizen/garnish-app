-- P0 observability: add deterministic routing/cache metadata to the AI call ledger.
-- Additive only; null preserves historical rows and avoids fabricated cache data.
ALTER TABLE "AICallLog" ADD COLUMN "intent" TEXT;
ALTER TABLE "AICallLog" ADD COLUMN "tier" TEXT;
ALTER TABLE "AICallLog" ADD COLUMN "cacheHit" BOOLEAN;
ALTER TABLE "AICallLog" ADD COLUMN "cacheTokens" INTEGER;

CREATE INDEX "AICallLog_intent_tier_createdAt_idx" ON "AICallLog"("intent", "tier", "createdAt");
CREATE INDEX "AICallLog_cacheHit_createdAt_idx" ON "AICallLog"("cacheHit", "createdAt");