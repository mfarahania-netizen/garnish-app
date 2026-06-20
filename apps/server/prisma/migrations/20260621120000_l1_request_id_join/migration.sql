-- L1 join key (guardian spec-review's #1 must-not-slip / unrecoverable item): a shared requestId stamped on
-- BOTH the served slate and the reward/attribution event, so exposure↔reward becomes joinable at
-- (recipe, position, propensity) grain for off-policy / IPS learning. Additive nullable; pure instrumentation.
ALTER TABLE "RecommendationServedItem" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "RecommendationAttributionEvent" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "RecommendationServedItem_requestId_idx" ON "RecommendationServedItem" ("requestId");
CREATE INDEX IF NOT EXISTS "RecommendationAttributionEvent_requestId_idx" ON "RecommendationAttributionEvent" ("requestId");
