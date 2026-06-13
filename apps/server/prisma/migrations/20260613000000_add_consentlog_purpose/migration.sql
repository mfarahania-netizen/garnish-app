-- E52 / B2B-B0: additive, nullable consent processing-purpose column.
-- Mirrors the canonical event-envelope consentPurpose (ADR-0001).
-- Additive only; no data change. Rollback: ALTER TABLE "ConsentLog" DROP COLUMN "purpose";
ALTER TABLE "ConsentLog" ADD COLUMN "purpose" TEXT;
