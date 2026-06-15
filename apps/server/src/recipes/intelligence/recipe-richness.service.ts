/**
 * RecipeRichnessService (GARNISH-RECIPE-L4-07) — the consolidated recipe read.
 *
 * ONE authed call returns the full recipe + integrity report + (if authed) personalized fit + safety
 * check + grounded substitution swaps — so the UI/AI never assembles it piecemeal.
 *
 * REUSE, not duplication: personalization comes from ProfileReadService.getLivingUserProfile (the
 * canonical unified profile) and substitutions from AiAssistService (the S1 grounded path, which routes
 * through the nutrition-claim guard). It does NOT build a parallel recommender and does NOT touch frozen
 * runtime-shadow. Declared allergies stay safety-critical (hard filter, never softened).
 */
import { Injectable, Logger } from '@nestjs/common';
import { RecipesService } from '../recipes.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { AiAssistService } from '../../ai/assist/ai-assist.service';
import { analyzeRecipeIntegrity, IntegrityReport } from './recipe-integrity';
import { assessRecipeFit, RecipeFitAssessment } from './recipe-fit';
import { looseMatch, norm } from '../../ai/tools/grounding-utils';

const MAX_SWAP_TARGETS = 3;

export interface RichRecipe {
  recipe: any;
  integrity: IntegrityReport;
  personalized: boolean;
  fit: RecipeFitAssessment | null;
  substitutions: { ingredient: string; reason: 'allergen' | 'dislike'; result: unknown }[] | null;
}

@Injectable()
export class RecipeRichnessService {
  private readonly logger = new Logger(RecipeRichnessService.name);

  constructor(
    private readonly recipes: RecipesService,
    private readonly profiles: ProfileReadService,
    private readonly assist: AiAssistService,
  ) {}

  async getRichRecipe(id: string, userId?: string): Promise<RichRecipe | null> {
    const recipe = await this.recipes.findOne(id);
    if (!recipe) return null;
    const integrity = analyzeRecipeIntegrity(recipe);

    if (!userId) {
      return { recipe, integrity, personalized: false, fit: null, substitutions: null };
    }

    let fit: RecipeFitAssessment | null = null;
    let substitutions: RichRecipe['substitutions'] = null;
    try {
      const profile = await this.profiles.getLivingUserProfile(userId);
      fit = assessRecipeFit(recipe, profile, integrity.derivedAllergens.allergens);
      substitutions = await this.surfaceSwaps(userId, recipe, fit);
    } catch (err) {
      this.logger.warn(`personalization unavailable; returning recipe + integrity only: ${err instanceof Error ? err.name : 'error'}`);
    }
    return { recipe, integrity, personalized: Boolean(fit), fit, substitutions };
  }

  /** Surface grounded swaps (S1) for the recipe ingredients that conflict with allergies/dislikes. */
  private async surfaceSwaps(userId: string, recipe: any, fit: RecipeFitAssessment) {
    const ingNames: string[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((i: any) => String(i?.name ?? '')).filter(Boolean) : [];
    const conflictingAllergens = fit.safety.conflictingAllergens;
    const targets: { ingredient: string; reason: 'allergen' | 'dislike' }[] = [];
    for (const name of ingNames) {
      if (conflictingAllergens.some((a) => looseMatch(name, a))) targets.push({ ingredient: name, reason: 'allergen' });
      else if (fit.dislikedIngredientWarnings.some((d) => norm(d) === norm(name))) targets.push({ ingredient: name, reason: 'dislike' });
    }
    const out: RichRecipe['substitutions'] = [];
    for (const t of targets.slice(0, MAX_SWAP_TARGETS)) {
      try {
        const result = await this.assist.substitutions(userId, { ingredient: t.ingredient, avoidAllergens: conflictingAllergens });
        out.push({ ingredient: t.ingredient, reason: t.reason, result });
      } catch {
        /* skip a failed swap; never break the read */
      }
    }
    return out;
  }
}
