-- L0 gate: GDPR provenance — every UserEvent records the consent purpose it was collected under.
-- Additive + nullable: existing rows stay NULL; readers unchanged. Default-off ingest stamps 'analytics'
-- (legitimate-interest baseline); the consent gate upgrades to 'personalization' when granted.
ALTER TABLE "UserEvent" ADD COLUMN IF NOT EXISTS "consentPurpose" TEXT;

-- Filterable for the observability cabin / DSAR provenance audits without scanning every row.
CREATE INDEX IF NOT EXISTS "UserEvent_consentPurpose_idx" ON "UserEvent" ("consentPurpose");
