-- WorkflowAlert incident lifecycle fields.
-- Additive only: old alerts remain valid and can be backfilled operationally later.
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "ownerRole" TEXT;
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "resolutionReason" TEXT;
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "lastChangedBy" TEXT;
ALTER TABLE "WorkflowAlert" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "WorkflowAlert_status_dueAt_idx" ON "WorkflowAlert"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "WorkflowAlert_assignedTo_status_idx" ON "WorkflowAlert"("assignedTo", "status");
