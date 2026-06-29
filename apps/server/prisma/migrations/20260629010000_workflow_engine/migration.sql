-- Admin Control Center — workflow automation engine (spec §B6): Workflow (definition) / WorkflowRun (run,
-- JSONB step-state) / WorkflowAlert (the Command feed). Additive: three new tables, no existing data touched.

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL DEFAULT 'schedule',
    "intervalSec" INTEGER,
    "eventType" TEXT,
    "graph" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "defaultSeverity" TEXT NOT NULL DEFAULT 'info',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersion" INTEGER NOT NULL DEFAULT 1,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "stepState" JSONB,
    "outcome" JSONB,
    "error" TEXT,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAlert" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "runId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metric" TEXT,
    "value" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "acknowledgedBy" TEXT,
    "channelsSent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_key_key" ON "Workflow"("key");

-- CreateIndex
CREATE INDEX "Workflow_enabled_triggerType_nextRunAt_idx" ON "Workflow"("enabled", "triggerType", "nextRunAt");

-- CreateIndex
CREATE INDEX "Workflow_eventType_idx" ON "Workflow"("eventType");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_startedAt_idx" ON "WorkflowRun"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_startedAt_idx" ON "WorkflowRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowAlert_status_severity_createdAt_idx" ON "WorkflowAlert"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowAlert_workflowKey_createdAt_idx" ON "WorkflowAlert"("workflowKey", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
