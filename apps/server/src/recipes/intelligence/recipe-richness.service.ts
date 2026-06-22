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
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { AiAssistService } from '../../ai/assist/ai-assist.service';
import { analyzeRecipeIntegrity, IntegrityReport, extractDictionaryAllergens, allergensConflict } from './recipe-integrity';
import { assessRecipeFit, RecipeFitAssessment } from './recipe-fit';
import { looseMatch, norm, toStringArray } from '../../ai/tools/grounding-utils';
import { parseGrisName, sumNutrition, NutritionItem, NutritionResult } from './recipe-personalize';

const MAX_SWAP_TARGETS = 3;

export interface RichRecipe {
  recipe: any;
  integrity: IntegrityReport;
  personalized: boolean;
  fit: RecipeFitAssessment | null;
  substitutions: { ingredient: string; reason: 'allergen' | 'dislike'; result: unknown }[] | null;
}

export interface PersonalizeInput {
  servings?: number;
  swaps?: { from: string; to: string }[];
  removed?: string[];
}

export interface PersonalizedRecipe {
  id: string;
  baseServings: number;
  servings: number;
  scaleFactor: number;
  swaps: { from: string; to: string; toIngredientId: string | null; allergenWarning: string | null }[];
  removed: string[];
  nutrition: NutritionResult;
  notes: string[];
}

@Injectable()
export class RecipeRichnessService {
  private readonly logger = new Logger(RecipeRichnessService.name);

  constructor(
    private readonly recipes: RecipesService,
    private readonly prisma: PrismaService,
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

  /**
   * personalize (Phase 4 cascade) — given the session {servings, swaps, removed}, recompute the
   * grounded nutrition (source-locked per-100g × real gram weights) and re-gate every swap target
   * against the user's declared allergies (I1/I2). Read-only: it never mutates the recipe, the profile,
   * or the allergy filter; per-serving values are honest (coverage-flagged, never fabricated).
   */
  async personalize(id: string, userId: string, input: PersonalizeInput): Promise<PersonalizedRecipe | null> {
    const recipe = await this.recipes.findOne(id);
    if (!recipe) return null;
    const gris = (recipe as any).gris ?? null;
    const swaps = Array.isArray(input?.swaps) ? input.swaps.filter((s) => s?.from && s?.to) : [];
    const removed = Array.isArray(input?.removed) ? input.removed.filter((n) => typeof n === 'string') : [];
    const baseServings = this.grisServings(gris) ?? (Number((recipe as any).servings) || 4);
    const servings = input?.servings && input.servings > 0 ? input.servings : baseServings;
    const scaleFactor = baseServings > 0 ? servings / baseServings : 1;

    // declared allergies (the hard, safety-critical set) — read-only, for the swap re-gate only
    let declared: string[] = [];
    try {
      const profile = await this.profiles.getLivingUserProfile(userId);
      declared = toStringArray((profile as any)?.reconciled?.dimensions?.allergies?.reconciledValue).map((a) => a.toLowerCase());
    } catch {
      /* no profile → nothing to re-gate against */
    }

    // resolve each swap target to a REAL dictionary ingredient (id + allergens + nutrition) — grounding + I2
    const targetByFrom = new Map<string, { toIngredientId: string | null; per100g: Record<string, unknown> | null; allergenWarning: string | null }>();
    for (const s of swaps) {
      let resolved: { toIngredientId: string | null; per100g: Record<string, unknown> | null; allergenWarning: string | null } = { toIngredientId: null, per100g: null, allergenWarning: null };
      try {
        const ing = await this.lookupIngredientByName(s.to);
        if (ing) resolved = { toIngredientId: ing.id, per100g: (ing.nutritionPer100g as Record<string, unknown>) ?? null, allergenWarning: this.allergenConflict(ing.allergens, declared) };
      } catch {
        /* unresolved target → no nutrition contribution, no id (honest) */
      }
      targetByFrom.set(norm(s.from), resolved);
    }

    // GRIS gram weights are the only honest per-ingredient grams → recompute nutrition from them
    const removedNorm = new Set(removed.map(norm));
    const grisIngs: any[] = Array.isArray(gris?.ingredients) ? gris.ingredients : [];
    const idsNeeded = new Set<string>();
    for (const gi of grisIngs) {
      // v2.1 carries an explicit ingredientId; v2.0 embedded it in the «— ing_xxx» name suffix
      const ingredientId = gi?.ingredientId || parseGrisName(gi?.name).ingredientId;
      if (ingredientId) idsNeeded.add(ingredientId);
    }
    const dictById = await this.lookupIngredientsByIds([...idsNeeded]);

    const items: NutritionItem[] = [];
    for (const gi of grisIngs) {
      const parsed = parseGrisName(gi?.name);
      const display = parsed.display;
      const ingredientId = gi?.ingredientId || parsed.ingredientId;
      if (removedNorm.has(norm(display))) continue; // removed → no contribution
      const swapped = targetByFrom.get(norm(display));
      const per100g = swapped && !swapped.allergenWarning && swapped.per100g
        ? swapped.per100g
        : ingredientId
          ? ((dictById.get(ingredientId)?.nutritionPer100g as Record<string, unknown>) ?? null)
          : null;
      items.push({ weightG: typeof gi?.weightG === 'number' ? gi.weightG : null, per100g });
    }
    const nutrition = sumNutrition(items, baseServings);

    const swapsOut = swaps.map((s) => {
      const t = targetByFrom.get(norm(s.from));
      return { from: s.from, to: s.to, toIngredientId: t?.toIngredientId ?? null, allergenWarning: t?.allergenWarning ?? null };
    });

    const notes: string[] = [];
    if (nutrition.coverage === 'partial') notes.push('ارزش غذایی تخمینی است (پوششِ ناقصِ مواد).');
    if (swapsOut.some((s) => s.allergenWarning)) notes.push('یک جایگزین با حساسیتِ اعلام‌شده‌ات هم‌خوانی ندارد و در محاسبه لحاظ نشد.');

    return { id, baseServings, servings, scaleFactor, swaps: swapsOut, removed, nutrition, notes };
  }

  private grisServings(gris: any): number | null {
    const s = gris?.glance?.servings;
    return typeof s === 'number' && s > 0 ? s : null;
  }

  private allergenConflict(allergens: unknown, declared: string[]): string | null {
    if (!declared.length) return null;
    // GUARDIAN (final re-verify): read the canonical {eu14,us9,other,mayContain} dictionary shape (toStringArray
    // returned [] on it → FAIL-OPEN) and intersect through the SAME alias map the hard gate uses — so a swap TO an
    // allergenic substitute is correctly flagged, fa/en/Persian, EXACT-canonical (no looseMatch substring entangle).
    const conflicts = allergensConflict(extractDictionaryAllergens(allergens), declared);
    return conflicts[0] ?? null;
  }

  private async lookupIngredientByName(name: string) {
    const q = String(name ?? '').trim();
    if (q.length < 2) return null;
    return this.prisma.ingredient.findFirst({
      where: { OR: [{ nameFa: { contains: q } }, { nameEn: { contains: q } }] },
      select: { id: true, nameFa: true, allergens: true, nutritionPer100g: true },
    });
  }

  private async lookupIngredientsByIds(ids: string[]): Promise<Map<string, { nutritionPer100g: unknown }>> {
    const map = new Map<string, { nutritionPer100g: unknown }>();
    if (!ids.length) return map;
    const rows = await this.prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true, nutritionPer100g: true } });
    for (const r of rows) map.set(r.id, { nutritionPer100g: r.nutritionPer100g });
    return map;
  }
}
