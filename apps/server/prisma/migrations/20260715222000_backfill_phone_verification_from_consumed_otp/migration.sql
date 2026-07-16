-- Existing accounts are verified only when the database already contains
-- successful login-OTP evidence for the exact normalized phone. This keeps the
-- Household identity boundary fail-closed while avoiding a forced re-login for
-- users who completed OTP before phoneVerifiedAt existed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "User" AS u
SET "phoneVerifiedAt" = evidence."verifiedAt"
FROM (
  SELECT phone, MAX("consumedAt") AS "verifiedAt"
  FROM "AuthOtpCode"
  WHERE purpose = 'login'
    AND "consumedAt" IS NOT NULL
  GROUP BY phone
) AS evidence
WHERE u.phone = evidence.phone
  AND u."isGuest" = FALSE
  AND u."phoneVerifiedAt" IS NULL;

COMMIT;
