/**
 * L1 cohort/region join key — the spine of the cold-start prior (population → region → cohort → person with
 * hierarchical shrinkage). A pure, deterministic deriver: fewer known facets ⇒ a broader cohort, so a brand-new
 * Dutch user with only a country still resolves a useful regional prior. (Distinct from analytics/intelligence/
 * cohort.ts, which is retention-curve cohorting — a different domain.)
 */
export interface CohortFacets {
  country?: string | null; // ISO-3166 (e.g. NL)
  locale?: string | null; // BCP-47 (e.g. nl-NL) — country falls back to its region subtag
  diet?: string | null; // dietary pattern (vegetarian/halal/…)
  skill?: string | null; // cooking skill (beginner/…)
  occasion?: string | null; // active real-time occasion (christmas/yalda/…)
}

const norm = (s?: string | null): string =>
  typeof s === 'string' ? s.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') : '';

/** ISO country for the region-scope prior: explicit country, else the region subtag of a BCP-47 locale. null if unknown. */
export function regionKey(f: CohortFacets): string | null {
  const explicit = norm(f.country);
  if (explicit) return explicit;
  const sub = norm(f.locale).split('-')[1] || '';
  return sub || null;
}

/**
 * Deterministic cohort key for the cohort-scope prior. Facets are normalized, missing ones omitted, and the
 * remainder sorted — so the key is stable regardless of input order, and fewer facets yield a broader (less
 * sparse) cohort that shrinkage leans on. Returns null when no facet is known (caller falls back to population).
 */
export function deriveCohortKey(f: CohortFacets): string | null {
  const parts: string[] = [];
  const region = regionKey(f);
  if (region) parts.push(`country=${region}`);
  if (norm(f.diet)) parts.push(`diet=${norm(f.diet)}`);
  if (norm(f.skill)) parts.push(`skill=${norm(f.skill)}`);
  if (norm(f.occasion)) parts.push(`occasion=${norm(f.occasion)}`);
  return parts.length ? parts.sort().join(';') : null;
}

/**
 * Map a user record (+ the active occasion) to cohort facets. SHARED by the L1 prior read path
 * (RecipePriorService) and the learner (RecipePriorLearnerService) so BOTH derive the SAME cohortKey for the
 * same user/occasion — a divergent mapping would silently miss the cohort prior. Pure; tolerates partial rows.
 */
export function facetsFromUser(
  user:
    | { locale?: string | null; country?: string | null; preferences?: { diet?: string | null; skillLevel?: string | null } | null }
    | null
    | undefined,
  occasionKey?: string | null,
): CohortFacets {
  return {
    country: user?.country ?? null,
    locale: user?.locale ?? null,
    diet: user?.preferences?.diet ?? null,
    skill: user?.preferences?.skillLevel ?? null,
    occasion: occasionKey ?? null,
  };
}
