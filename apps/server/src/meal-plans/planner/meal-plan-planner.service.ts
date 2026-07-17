/**
 * MealPlanPlannerService (GARNISH-PLANNER-L4-09) — proposes an intelligent weekly plan.
 *
 * REUSE, not duplication: personalization from ProfileReadService.getLivingUserProfile (unified profile),
 * per-recipe fit from S07 assessRecipeFit + analyzeRecipeIntegrity (derived allergens). Declared allergies
 * are a HARD EXCLUSION — an allergen-conflicting recipe is NEVER placed in a proposed plan. The proposal
 * is NOT written (the existing slot CRUD is the apply path). No parallel recommender; runtime-shadow untouched.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { analyzeRecipeIntegrity } from '../../recipes/intelligence/recipe-integrity';
import { assessRecipeFit } from '../../recipes/intelligence/recipe-fit';
import { toStringArray, norm } from '../../ai/tools/grounding-utils';
import { generateMealPlan, proposeSwapForSlot, PlanCandidate, PlanProposal, ProposedSlot } from './meal-plan-generator';
import { deriveCourse } from './course';
import { ConsentService } from '../../consent/consent.service';

const CORPUS_CAP = 400;
const COOKS_FOR_TO_SIZE: Record<string, number> = { '1': 1, '2': 2, '3_4': 3, '5_plus': 5 };
const DECLINE_EVENTS = ['recommendation_dismiss', 'not_interested', 'recipe_skip', 'mealplan_remove']; // FI-STEP-1/1.3
const RECENTLY_DECLINED_WINDOW_DAYS = 30;

function parseMealTypes(mealType: unknown): string[] {
  const tokens = toStringArray(mealType).map(norm).concat(norm(mealType));
  const out = new Set<string>();
  for (const t of tokens) {
    if (/breakfast|صبحانه/.test(t)) out.add('breakfast');
    if (/lunch|ناهار|نهار/.test(t)) out.add('lunch');
    if (/dinner|شام/.test(t)) out.add('dinner');
    if (/snack|میان|عصرانه/.test(t)) out.add('snack');
  }
  // unknown/empty mealType → eligible for any main meal (don't over-exclude)
  return out.size ? [...out] : ['breakfast', 'lunch', 'dinner'];
}

function householdFromProfile(profile: any): number {
  const cooksFor = profile?.declared?.dimensions?.['context.cooks_for_count']?.value;
  return COOKS_FOR_TO_SIZE[String(cooksFor)] ?? 1;
}

@Injectable()
export class MealPlanPlannerService {
  private readonly logger = new Logger(MealPlanPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
    private readonly consent: ConsentService,
  ) {}

  private async hasPersonalization(userId: string): Promise<boolean> {
    try { return await this.consent.hasPurpose(userId, 'personalization'); } catch { return false; }
  }

  async proposePlan(userId: string, opts: { meals?: string[]; days?: number } = {}): Promise<PlanProposal & { personalized: boolean; excludedForAllergy: number }> {
    const profile = await this.profiles.getLivingUserProfile(userId);
    const { candidates, excludedForAllergy } = await this.buildSafeCandidates(profile);
    const personalized = await this.hasPersonalization(userId);
    // FI-STEP-1.3: exclude recipes the user recently declined/removed (additive; downstream of allergy)
    const excludeRecipeIds = personalized ? await this.recentlyDeclinedIds(userId) : new Set<string>();
    const proposal = generateMealPlan(candidates, { meals: opts.meals, days: opts.days, householdSize: householdFromProfile(profile), excludeRecipeIds });
    return { ...proposal, personalized, excludedForAllergy };
  }

  /**
   * FI-STEP-1.3 — per-slot «یکی دیگه». Returns the next-best safe, course-valid recipe for ONE slot only,
   * excluding the current dish + recently-declined + anything already shown for this slot. No week regenerate.
   */
  async swapSlot(
    userId: string,
    input: { dayOfWeek: number; mealType: string; excludeRecipeIds?: string[] },
  ): Promise<{ slot: ProposedSlot | null; personalized: boolean }> {
    const profile = await this.profiles.getLivingUserProfile(userId);
    const { candidates } = await this.buildSafeCandidates(profile);
    const personalized = await this.hasPersonalization(userId);
    const recentlyDeclined = personalized ? await this.recentlyDeclinedIds(userId) : new Set<string>();
    const exclude = new Set<string>([...recentlyDeclined, ...(input.excludeRecipeIds ?? [])]);
    const slot = proposeSwapForSlot(candidates, { dayOfWeek: input.dayOfWeek, meal: input.mealType, excludeRecipeIds: exclude });
    return { slot, personalized };
  }

  /** Allergy-safe, fit-scored, course-derived candidates (shared by proposePlan + swapSlot). Allergen-
   *  conflicting recipes are HARD-EXCLUDED here — unchanged from the original proposePlan loop. */
  private async buildSafeCandidates(profile: any): Promise<{ candidates: PlanCandidate[]; excludedForAllergy: number }> {
    const recipes = await this.prisma.recipe.findMany({
      where: { isPublic: true, status: 'active' }, // advisor audit: plan/swap only from published recipes
      take: CORPUS_CAP,
      select: { id: true, title: true, diet: true, mealType: true, region: true, category: true, categories: true, difficulty: true, cookingTime: true, allergens: true, ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } } },
    });

    const candidates: PlanCandidate[] = [];
    let excludedForAllergy = 0;
    for (const r of recipes) {
      const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
      const fit = assessRecipeFit(r, profile, derived);
      if (fit.safety.allergenConflict || fit.recommendation === 'avoid_allergen' || fit.safety.culturalConflict || fit.recommendation === 'avoid_constraint') {
        excludedForAllergy += 1; // HARD EXCLUDE — a declared allergy OR observance (pork/halal) is never planned
        continue;
      }
      // S5 course gate: derive main-meal-eligibility from the EXISTING category + mealType (read-time, no
      // migration). Applied to candidates that have ALREADY passed the allergy HARD-filter above.
      const { course, mainMealEligible } = deriveCourse({ category: (r as any).category, categories: r.categories, mealTypeTokens: r.mealType });
      candidates.push({
        recipeId: r.id,
        title: r.title,
        mealTypes: parseMealTypes(r.mealType),
        cuisine: r.region ? norm(r.region) : null,
        categories: toStringArray(r.categories),
        ingredients: (r.ingredients ?? []).map((i: any) => norm(i.name)).filter(Boolean),
        cookingTime: typeof r.cookingTime === 'number' ? r.cookingTime : null,
        fitScore: fit.fitScore,
        fitReasons: fit.reasons,
        course,
        mainMealEligible,
      });
    }
    return { candidates, excludedForAllergy };
  }

  /** Recipe ids the user declined/removed within the recency window — from the EXISTING UserEvent stream
   *  (the decline events FI-STEP-1 already writes). Read-only; touches no allergy/recsys/global-flip path. */
  private async recentlyDeclinedIds(userId: string): Promise<Set<string>> {
    const cutoff = new Date(Date.now() - RECENTLY_DECLINED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const events = await this.prisma.userEvent.findMany({
      where: {
        userId,
        consentPurpose: 'personalization',
        type: { in: DECLINE_EVENTS },
        timestamp: { gte: cutoff },
      },
      select: { payload: true },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });
    const ids = new Set<string>();
    for (const e of events) {
      try {
        const p = JSON.parse((e as any).payload || '{}');
        if (p?.recipeId) ids.add(String(p.recipeId));
        if (Array.isArray(p?.recipeIds)) for (const id of p.recipeIds) ids.add(String(id));
      } catch { /* ignore malformed payloads */ }
    }
    return ids;
  }
}
