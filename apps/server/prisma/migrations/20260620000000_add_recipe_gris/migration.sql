-- GRIS v2 — additive, idempotent. Adds the full Garnish Recipe Intelligence Standard JSON blob and the
-- queryable pork-avoidance flag to Recipe. Applied in dev via a raw ALTER first; this file keeps the
-- migrations history in sync and is safe to re-apply (IF NOT EXISTS) on any environment.
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "gris" JSONB;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "containsPork" BOOLEAN NOT NULL DEFAULT false;
