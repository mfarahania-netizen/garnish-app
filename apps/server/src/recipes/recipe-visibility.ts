/**
 * SECURITY (advisor audit) — the single source of truth for "a recipe the public may see".
 *
 * A user-authored recipe is created status:'pending', isPublic default true (recipes.service create), so EVERY
 * path that returns a recipe to a non-admin/anonymous caller must require status:'active' AND isPublic. All 1008…
 * curated recipes are status:'active'+isPublic, so applying this is byte-identical today and only excludes future
 * unreviewed UGC. Spread it into the Prisma `where` at each public read chokepoint:
 *   where: { ...PUBLISHED_RECIPE_WHERE, ...otherFilters }
 */
export const PUBLISHED_RECIPE_WHERE = { status: 'active', isPublic: true } as const;
