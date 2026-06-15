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
import { generateMealPlan, PlanCandidate, PlanProposal } from './meal-plan-generator';

const CORPUS_CAP = 400;
const COOKS_FOR_TO_SIZE: Record<string, number> = { '1': 1, '2': 2, '3_4': 3, '5_plus': 5 };

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

  constructor(private readonly prisma: PrismaService, private readonly profiles: ProfileReadService) {}

  async proposePlan(userId: string, opts: { meals?: string[]; days?: number } = {}): Promise<PlanProposal & { personalized: boolean; excludedForAllergy: number }> {
    const profile = await this.profiles.getLivingUserProfile(userId);
    const recipes = await this.prisma.recipe.findMany({
      where: { isPublic: true },
      take: CORPUS_CAP,
      select: { id: true, title: true, diet: true, mealType: true, region: true, categories: true, difficulty: true, cookingTime: true, allergens: true, ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } } },
    });

    const candidates: PlanCandidate[] = [];
    let excludedForAllergy = 0;
    for (const r of recipes) {
      const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
      const fit = assessRecipeFit(r, profile, derived);
      if (fit.safety.allergenConflict || fit.recommendation === 'avoid_allergen') {
        excludedForAllergy += 1; // HARD EXCLUDE — a declared allergy is never planned
        continue;
      }
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
      });
    }

    const proposal = generateMealPlan(candidates, { meals: opts.meals, days: opts.days, householdSize: householdFromProfile(profile) });
    return { ...proposal, personalized: true, excludedForAllergy };
  }
}
