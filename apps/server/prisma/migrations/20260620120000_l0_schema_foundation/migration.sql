-- L0 living-intelligence core — schema foundation. STRICTLY ADDITIVE + idempotent: only new nullable
-- columns, new tables, and new indexes. Touches NO existing column/constraint, so the allergy HARD
-- filter and getLivingUserProfile cold-start stay byte-identical, and existing rows are untouched.

-- 1) UserEvent: denormalized recipeId (recipe id currently lives only inside the opaque payload string)
ALTER TABLE "UserEvent" ADD COLUMN IF NOT EXISTS "recipeId" TEXT;
CREATE INDEX IF NOT EXISTS "UserEvent_userId_recipeId_timestamp_idx" ON "UserEvent" ("userId", "recipeId", "timestamp");

-- 2) SignalObservation: full typed-signal contract (all nullable/defaulted so the existing writer at
--    recipe.signal-processor.ts and reader at recommendation-shadow-a8-adapters.ts keep working unchanged)
ALTER TABLE "SignalObservation" ADD COLUMN IF NOT EXISTS "recipeId" TEXT;
ALTER TABLE "SignalObservation" ADD COLUMN IF NOT EXISTS "dimension" TEXT;
ALTER TABLE "SignalObservation" ADD COLUMN IF NOT EXISTS "value" TEXT;
ALTER TABLE "SignalObservation" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "SignalObservation" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'legacy_event';
CREATE INDEX IF NOT EXISTS "SignalObservation_userId_signalName_observedAt_idx" ON "SignalObservation" ("userId", "signalName", "observedAt");
CREATE INDEX IF NOT EXISTS "SignalObservation_userId_recipeId_idx" ON "SignalObservation" ("userId", "recipeId");

-- 3) UserConsent: opt-IN, versioned, point-in-time consent-at-ingest record (separate from ConsentLog)
CREATE TABLE IF NOT EXISTS "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "lawfulBasis" TEXT NOT NULL DEFAULT 'consent',
    "policyVersion" TEXT,
    "source" TEXT,
    "ip" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UserConsent_userId_purpose_idx" ON "UserConsent" ("userId", "purpose");

-- 4) PantryItem: user on-hand inventory (ingredientId soft link via SetNull)
CREATE TABLE IF NOT EXISTS "PantryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "unit" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PantryItem_userId_idx" ON "PantryItem" ("userId");
CREATE INDEX IF NOT EXISTS "PantryItem_ingredientId_idx" ON "PantryItem" ("ingredientId");

-- 5) Foreign keys for the two new tables (erasure-safe: User=Cascade, Ingredient=SetNull)
DO $$ BEGIN
    ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
