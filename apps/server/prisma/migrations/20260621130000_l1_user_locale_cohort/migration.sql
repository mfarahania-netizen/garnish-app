-- L1 cohort/region join key (launch-critical for Europe-general cold-start): a user-side locale + country so
-- recommendations can resolve population→cohort→region priors with hierarchical shrinkage. Additive nullable.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;
