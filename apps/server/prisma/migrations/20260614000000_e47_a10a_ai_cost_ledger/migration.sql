-- E47-A10A: persisted AI cost/usage ledger fields on AICallLog (R3 mitigation).
-- Additive only — nullable columns + one index. No DROP / DELETE / TRUNCATE / data reset.

-- AlterTable
ALTER TABLE "AICallLog" ADD COLUMN     "costIsEstimated" BOOLEAN,
ADD COLUMN     "costSchemaVersion" INTEGER,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "totalTokens" INTEGER,
ADD COLUMN     "usageSource" TEXT;

-- CreateIndex
CREATE INDEX "AICallLog_provider_model_createdAt_idx" ON "AICallLog"("provider", "model", "createdAt");
