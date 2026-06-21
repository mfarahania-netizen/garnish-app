import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { assessRecipeFit } from './recipe-fit';
import { analyzeRecipeIntegrity } from './recipe-integrity';
import { PUBLISHED_RECIPE_WHERE } from '../recipe-visibility';

/**
 * THE single, reusable HARD safety gate (guardian H1 rework). The allergy/observance invariant must hold on
 * EVERY user-facing recipe-serving path — /recommendations AND the /recipes popular/fresh rails (Home/
 * Discover) AND search AND similar — not just one. Drops recommendation 'avoid_allergen' (declared allergy)
 * AND 'avoid_constraint' (pork for halal/kosher/no_pork).
 *
 * POLICY:
 *  - Authenticated user → FAIL-CLOSED: if the living profile (incl. its allergy read) can't load, return
 *    NOTHING rather than something unsafe.
 *  - Anonymous (no userId) → pass through: there is no declared allergy profile to enforce against. The
 *    caller must NOT expose declared allergies anonymously (we don't have them). This is the documented policy.
 */
export const SAFETY_FIT_SELECT = {
  id: true, title: true, diet: true, allergens: true, categories: true, region: true, containsPork: true,
  ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } },
} as const;

@Injectable()
export class RecipeSafetyFilterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
  ) {}

  /** The SAFE subset of candidate ids for this user (order preserved). Anonymous → all; authed → fail-closed. */
  async safeIds(userId: string | null | undefined, candidateIds: string[]): Promise<string[]> {
    if (!candidateIds.length) return [];
    if (!userId) return candidateIds; // anonymous: no declared allergy set to enforce (documented policy)
    let profile: any;
    try {
      profile = await this.profiles.getLivingUserProfile(userId);
    } catch {
      return []; // FAIL-CLOSED: cannot establish the safe allergy set → nothing rather than something unsafe
    }
    if (!profile) return [];
    // SECURITY (advisor audit): this is THE recommendation chokepoint — also exclude unreviewed UGC (pending),
    // not just allergy conflicts, so a pending recipe id from the trending/collaborative/similar buckets (which
    // derive ids from non-Recipe tables) can never reach a served slate. Byte-identical today (all curated active).
    const recipes = await this.prisma.recipe.findMany({ where: { id: { in: candidateIds }, ...PUBLISHED_RECIPE_WHERE }, select: SAFETY_FIT_SELECT });
    const safe = new Set<string>();
    for (const r of recipes) {
      const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
      const rec = assessRecipeFit(r, profile, derived).recommendation;
      if (rec !== 'avoid_allergen' && rec !== 'avoid_constraint') safe.add(r.id);
    }
    return candidateIds.filter((id) => safe.has(id));
  }

  /** Filter a list of recipe-shaped objects by `idKey` (default 'id'), preserving order + shape. */
  async filter<T extends Record<string, any>>(userId: string | null | undefined, rows: T[], idKey = 'id'): Promise<T[]> {
    if (!rows.length || !userId) return rows;
    const safe = new Set(await this.safeIds(userId, rows.map((r) => String(r[idKey]))));
    return rows.filter((r) => safe.has(String(r[idKey])));
  }
}
