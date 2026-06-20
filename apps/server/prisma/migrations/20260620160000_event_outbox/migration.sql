-- L0 — durable transactional-outbox for event routing (no lost signals on a crash). Additive new table.
CREATE TABLE IF NOT EXISTS "EventOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventOutbox_eventId_key" ON "EventOutbox" ("eventId");
CREATE INDEX IF NOT EXISTS "EventOutbox_status_createdAt_idx" ON "EventOutbox" ("status", "createdAt");
