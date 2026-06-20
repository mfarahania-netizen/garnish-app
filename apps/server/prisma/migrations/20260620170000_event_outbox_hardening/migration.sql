-- L0 outbox hardening (guardian findings): track claim time so a reaper can revive rows stuck in
-- 'processing' after a crash; the 'dead' status is a plain string value (no enum change needed).
ALTER TABLE "EventOutbox" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "EventOutbox_status_claimedAt_idx" ON "EventOutbox" ("status", "claimedAt");
