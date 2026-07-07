UPDATE "User" u
SET "onboardingCompletedAt" = COALESCE(u."updatedAt", NOW())
WHERE u."isGuest" = false
  AND u."onboardingCompletedAt" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "UserPreference" p WHERE p."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "UserBehaviorProfile" bp WHERE bp."userId" = u."id")
  );
