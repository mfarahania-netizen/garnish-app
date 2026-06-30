-- Admin RBAC + queryable audit ledger fields.
-- Additive: keeps legacy isAdmin/details behavior intact while giving ops/compliance real indexes.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "adminRole" TEXT NOT NULL DEFAULT 'user';

UPDATE "User"
SET "adminRole" = 'admin'
WHERE "isAdmin" = true AND ("adminRole" IS NULL OR "adminRole" = 'user');

ALTER TABLE "UserAuditLog"
ADD COLUMN IF NOT EXISTS "actorId" TEXT,
ADD COLUMN IF NOT EXISTS "targetId" TEXT,
ADD COLUMN IF NOT EXISTS "targetType" TEXT,
ADD COLUMN IF NOT EXISTS "reason" TEXT,
ADD COLUMN IF NOT EXISTS "riskLevel" TEXT;

CREATE INDEX IF NOT EXISTS "UserAuditLog_actorId_createdAt_idx" ON "UserAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserAuditLog_targetId_createdAt_idx" ON "UserAuditLog"("targetId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserAuditLog_action_createdAt_idx" ON "UserAuditLog"("action", "createdAt");
