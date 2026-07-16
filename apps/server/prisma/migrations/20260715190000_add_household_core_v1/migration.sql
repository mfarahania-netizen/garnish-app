-- Household H1/H2 thin slice. Additive only: legacy personal shopping/meal tables are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TYPE "HouseholdStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "HouseholdMembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');
CREATE TYPE "HouseholdInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');
CREATE TYPE "HouseholdShoppingItemStatus" AS ENUM ('NEEDED', 'BOUGHT', 'DECISION_PENDING', 'SUBSTITUTION_APPROVED', 'SKIPPED', 'REMOVED');
CREATE TYPE "HouseholdShoppingSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "HouseholdShoppingDecisionStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');
CREATE TYPE "HouseholdIdempotencyState" AS ENUM ('PROCESSING', 'COMPLETED');

CREATE TABLE "households" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "HouseholdStatus" NOT NULL DEFAULT 'ACTIVE',
  "ownerUserId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "households_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "households_version_check" CHECK ("version" >= 1),
  CONSTRAINT "households_name_check" CHECK (char_length("name") BETWEEN 1 AND 80)
);

CREATE TABLE "household_memberships" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "HouseholdRole" NOT NULL,
  "status" "HouseholdMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "household_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_memberships_version_check" CHECK ("version" >= 1),
  CONSTRAINT "household_memberships_active_end_check" CHECK (
    ("status" = 'ACTIVE' AND "endedAt" IS NULL) OR
    ("status" <> 'ACTIVE' AND "endedAt" IS NOT NULL)
  )
);

CREATE TABLE "household_invites" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdByMembershipId" TEXT,
  "targetPhoneDigest" TEXT,
  "targetDigestKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "activeKey" TEXT DEFAULT 'PENDING',
  "status" "HouseholdInviteStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "consumedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_invites_lifecycle_check" CHECK (
    ("status" = 'PENDING' AND "activeKey" = 'PENDING' AND "targetPhoneDigest" IS NOT NULL AND char_length("targetPhoneDigest") = 64 AND "consumedAt" IS NULL AND "consumedByUserId" IS NULL) OR
    ("status" <> 'PENDING' AND "activeKey" IS NULL AND "targetPhoneDigest" IS NULL)
  )
);

CREATE TABLE "household_shopping_lists" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'خرید خانه',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "household_shopping_lists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_shopping_lists_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "household_shopping_items" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "activeSemanticKey" TEXT,
  "amount" TEXT,
  "unit" TEXT,
  "status" "HouseholdShoppingItemStatus" NOT NULL DEFAULT 'NEEDED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "household_shopping_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_shopping_items_version_check" CHECK ("version" >= 1),
  CONSTRAINT "household_shopping_items_name_check" CHECK (char_length("name") BETWEEN 1 AND 120),
  CONSTRAINT "household_shopping_items_semantic_check" CHECK (
    ("status" IN ('BOUGHT', 'SKIPPED', 'REMOVED') AND "activeSemanticKey" IS NULL) OR
    ("status" NOT IN ('BOUGHT', 'SKIPPED', 'REMOVED') AND "activeSemanticKey" IS NOT NULL)
  )
);

CREATE TABLE "household_shopping_sessions" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "startedByMembershipId" TEXT,
  "status" "HouseholdShoppingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "activeKey" TEXT DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "household_shopping_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_shopping_sessions_version_check" CHECK ("version" >= 1),
  CONSTRAINT "household_shopping_sessions_lifecycle_check" CHECK (
    ("status" = 'ACTIVE' AND "activeKey" = 'ACTIVE' AND "endedAt" IS NULL) OR
    ("status" <> 'ACTIVE' AND "activeKey" IS NULL AND "endedAt" IS NOT NULL)
  )
);

CREATE TABLE "household_shopping_decisions" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdByMembershipId" TEXT,
  "resolvedByMembershipId" TEXT,
  "question" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "selectedOption" TEXT,
  "status" "HouseholdShoppingDecisionStatus" NOT NULL DEFAULT 'OPEN',
  "activeKey" TEXT DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "household_shopping_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_shopping_decisions_version_check" CHECK ("version" >= 1),
  CONSTRAINT "household_shopping_decisions_lifecycle_check" CHECK (
    ("status" = 'OPEN' AND "activeKey" = 'OPEN' AND "resolvedAt" IS NULL AND "resolvedByMembershipId" IS NULL) OR
    ("status" <> 'OPEN' AND "activeKey" IS NULL)
  )
);

CREATE TABLE "household_idempotency" (
  "id" TEXT NOT NULL,
  "principalUserId" TEXT NOT NULL,
  "householdId" TEXT,
  "operation" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" "HouseholdIdempotencyState" NOT NULL DEFAULT 'PROCESSING',
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "household_idempotency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_idempotency_key_check" CHECK (char_length("key") BETWEEN 8 AND 128),
  CONSTRAINT "household_idempotency_hash_check" CHECK (char_length("requestHash") = 64),
  CONSTRAINT "household_idempotency_lifecycle_check" CHECK (
    ("state" = 'PROCESSING' AND "response" IS NULL) OR
    ("state" = 'COMPLETED' AND "response" IS NOT NULL AND "householdId" IS NOT NULL)
  )
);

CREATE TABLE "household_audit_events" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "actorMembershipId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "household_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "households_ownerUserId_status_idx" ON "households"("ownerUserId", "status");
CREATE UNIQUE INDEX "household_memberships_householdId_userId_key" ON "household_memberships"("householdId", "userId");
CREATE INDEX "household_memberships_userId_status_idx" ON "household_memberships"("userId", "status");
CREATE INDEX "household_memberships_householdId_status_idx" ON "household_memberships"("householdId", "status");
CREATE UNIQUE INDEX "household_invites_householdId_targetPhoneDigest_activeKey_key" ON "household_invites"("householdId", "targetPhoneDigest", "activeKey");
CREATE INDEX "household_invites_targetPhoneDigest_status_expiresAt_idx" ON "household_invites"("targetPhoneDigest", "status", "expiresAt");
CREATE INDEX "household_invites_householdId_status_expiresAt_idx" ON "household_invites"("householdId", "status", "expiresAt");
CREATE UNIQUE INDEX "household_shopping_lists_householdId_key" ON "household_shopping_lists"("householdId");
CREATE UNIQUE INDEX "household_shopping_lists_id_householdId_key" ON "household_shopping_lists"("id", "householdId");
CREATE UNIQUE INDEX "household_shopping_items_listId_activeSemanticKey_key" ON "household_shopping_items"("listId", "activeSemanticKey");
CREATE UNIQUE INDEX "household_shopping_items_id_householdId_key" ON "household_shopping_items"("id", "householdId");
CREATE INDEX "household_shopping_items_householdId_status_idx" ON "household_shopping_items"("householdId", "status");
CREATE INDEX "household_shopping_items_listId_updatedAt_idx" ON "household_shopping_items"("listId", "updatedAt");
CREATE UNIQUE INDEX "household_shopping_sessions_listId_activeKey_key" ON "household_shopping_sessions"("listId", "activeKey");
CREATE INDEX "household_shopping_sessions_householdId_status_idx" ON "household_shopping_sessions"("householdId", "status");
CREATE UNIQUE INDEX "household_shopping_decisions_itemId_activeKey_key" ON "household_shopping_decisions"("itemId", "activeKey");
CREATE INDEX "household_shopping_decisions_householdId_status_expiresAt_idx" ON "household_shopping_decisions"("householdId", "status", "expiresAt");
CREATE UNIQUE INDEX "household_idempotency_principalUserId_operation_key_key" ON "household_idempotency"("principalUserId", "operation", "key");
CREATE INDEX "household_idempotency_householdId_createdAt_idx" ON "household_idempotency"("householdId", "createdAt");
CREATE INDEX "household_idempotency_expiresAt_idx" ON "household_idempotency"("expiresAt");
CREATE INDEX "household_audit_events_householdId_createdAt_idx" ON "household_audit_events"("householdId", "createdAt");
CREATE INDEX "household_audit_events_entityType_entityId_idx" ON "household_audit_events"("entityType", "entityId");

ALTER TABLE "households" ADD CONSTRAINT "households_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "household_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_consumedByUserId_fkey" FOREIGN KEY ("consumedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_shopping_lists" ADD CONSTRAINT "household_shopping_lists_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_items" ADD CONSTRAINT "household_shopping_items_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_items" ADD CONSTRAINT "household_shopping_items_listId_householdId_fkey" FOREIGN KEY ("listId", "householdId") REFERENCES "household_shopping_lists"("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_sessions" ADD CONSTRAINT "household_shopping_sessions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_sessions" ADD CONSTRAINT "household_shopping_sessions_listId_householdId_fkey" FOREIGN KEY ("listId", "householdId") REFERENCES "household_shopping_lists"("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_sessions" ADD CONSTRAINT "household_shopping_sessions_startedByMembershipId_fkey" FOREIGN KEY ("startedByMembershipId") REFERENCES "household_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_shopping_decisions" ADD CONSTRAINT "household_shopping_decisions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_decisions" ADD CONSTRAINT "household_shopping_decisions_itemId_householdId_fkey" FOREIGN KEY ("itemId", "householdId") REFERENCES "household_shopping_items"("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_shopping_decisions" ADD CONSTRAINT "household_shopping_decisions_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "household_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_shopping_decisions" ADD CONSTRAINT "household_shopping_decisions_resolvedByMembershipId_fkey" FOREIGN KEY ("resolvedByMembershipId") REFERENCES "household_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_idempotency" ADD CONSTRAINT "household_idempotency_principalUserId_fkey" FOREIGN KEY ("principalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_idempotency" ADD CONSTRAINT "household_idempotency_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_audit_events" ADD CONSTRAINT "household_audit_events_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_audit_events" ADD CONSTRAINT "household_audit_events_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "household_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
