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

/**
 * Whether a recipe may be shown to / referenced by this user: it is PUBLISHED (active + public) OR it is the
 * user's OWN draft. Used by authed own-content paths (favorites, meal-plan) where the row belongs to the user
 * but the referenced recipe might be someone else's unpublished UGC. Pure; null-safe.
 */
export function isRecipeVisibleTo(
  recipe: { status?: string | null; isPublic?: boolean | null; authorId?: string | null } | null | undefined,
  userId?: string | null,
): boolean {
  if (!recipe) return false;
  if (recipe.status === 'active' && recipe.isPublic !== false) return true;
  return !!userId && !!recipe.authorId && recipe.authorId === userId;
}
