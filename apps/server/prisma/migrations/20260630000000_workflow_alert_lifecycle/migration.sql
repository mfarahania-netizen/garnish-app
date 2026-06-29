-- AlterTable
ALTER TABLE "WorkflowAlert" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

