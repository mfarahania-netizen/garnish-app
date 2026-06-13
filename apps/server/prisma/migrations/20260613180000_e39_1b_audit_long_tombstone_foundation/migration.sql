-- DropForeignKey
ALTER TABLE "ConsentLog" DROP CONSTRAINT "ConsentLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserAuditLog" DROP CONSTRAINT "UserAuditLog_userId_fkey";

-- AlterTable
ALTER TABLE "ConsentLog" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserAuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ErasureEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subjectHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErasureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErasureEvent_subjectHash_createdAt_idx" ON "ErasureEvent"("subjectHash", "createdAt");

-- CreateIndex
CREATE INDEX "ErasureEvent_action_status_idx" ON "ErasureEvent"("action", "status");

-- AddForeignKey
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErasureEvent" ADD CONSTRAINT "ErasureEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

