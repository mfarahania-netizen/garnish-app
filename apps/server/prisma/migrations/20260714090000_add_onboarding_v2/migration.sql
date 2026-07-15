-- Onboarding V2: resumable typed draft + exact idempotency replay ledger.
-- PostgreSQL migrations are not implicitly transactional in every Prisma
-- deployment path. Keep this additive DDL atomic and fail quickly instead of
-- waiting behind long-lived writes to the User table.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "onboarding_profiles" (
    "userId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 2,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "safetyStatus" TEXT NOT NULL DEFAULT 'unknown',
    "allergyIds" JSONB NOT NULL DEFAULT '[]',
    "intoleranceIds" JSONB NOT NULL DEFAULT '[]',
    "dietaryRules" JSONB NOT NULL DEFAULT '[]',
    "dietPattern" TEXT,
    "weekdayTimeBucket" TEXT,
    "cooksForCount" TEXT,
    "likedRecipeIds" JSONB NOT NULL DEFAULT '[]',
    "dislikedRecipeIds" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_profiles_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "onboarding_mutations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_mutations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_mutations_userId_idempotencyKey_key"
ON "onboarding_mutations"("userId", "idempotencyKey");

CREATE INDEX "onboarding_mutations_userId_createdAt_idx"
ON "onboarding_mutations"("userId", "createdAt");

ALTER TABLE "onboarding_profiles"
ADD CONSTRAINT "onboarding_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "onboarding_mutations"
ADD CONSTRAINT "onboarding_mutations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
