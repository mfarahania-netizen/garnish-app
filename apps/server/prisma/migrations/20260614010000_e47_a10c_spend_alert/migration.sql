-- E47-A10C: spend-alert foundation (governance only; not billing). Additive — CREATE TABLE + FK SetNull.
-- No DROP / DELETE / TRUNCATE / data reset. userId FK is ON DELETE SET NULL (erasure-safe).

-- CreateTable
CREATE TABLE "AiSpendAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "thresholdType" TEXT NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "observedValue" DOUBLE PRECISION NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "dayUtc" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSpendAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSpendAlert_userId_dayUtc_idx" ON "AiSpendAlert"("userId", "dayUtc");

-- CreateIndex
CREATE INDEX "AiSpendAlert_thresholdType_dayUtc_idx" ON "AiSpendAlert"("thresholdType", "dayUtc");

-- AddForeignKey
ALTER TABLE "AiSpendAlert" ADD CONSTRAINT "AiSpendAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
