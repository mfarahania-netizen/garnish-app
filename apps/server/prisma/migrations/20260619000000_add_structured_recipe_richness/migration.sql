-- S3 Option-2: structured recipe richness (ADDITIVE, display-only).
-- Persists the four authored arrays the importer previously flattened into `tips`, plus authored dishType.
-- Nullable + default '[]' → existing rows and all existing code are unaffected. No safety-relevant column
-- (allergens / diet / ingredients / categories) is touched.
-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "chefTips" TEXT DEFAULT '[]',
ADD COLUMN "commonMistakes" TEXT DEFAULT '[]',
ADD COLUMN "servingSuggestions" TEXT DEFAULT '[]',
ADD COLUMN "substitutions" TEXT DEFAULT '[]',
ADD COLUMN "dishType" TEXT DEFAULT '[]';
