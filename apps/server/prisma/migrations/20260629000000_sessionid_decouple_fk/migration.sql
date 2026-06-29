-- Decouple UserEvent.sessionId from the UserSession foreign key.
-- sessionId becomes a plain client-generated correlation id (sessions are DERIVED at analysis time by the
-- 30-min inactivity gap), so an event insert never blocks on a UserSession row existing first. UserSession
-- stays a standalone model (GDPR export/erasure/retention still reference it). Non-destructive: no data loss.

-- DropForeignKey
ALTER TABLE "UserEvent" DROP CONSTRAINT "UserEvent_sessionId_fkey";

-- CreateIndex
CREATE INDEX "UserEvent_sessionId_idx" ON "UserEvent"("sessionId");
