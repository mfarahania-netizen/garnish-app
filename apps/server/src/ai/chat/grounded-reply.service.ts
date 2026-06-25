import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { assessRecipeFit } from '../../recipes/intelligence/recipe-fit';
import { analyzeRecipeIntegrity } from '../../recipes/intelligence/recipe-integrity';
import { looseMatch, toStringArray } from '../tools/grounding-utils';
import { foldPersian, aliasIngredient, isConfidentIngredientMatch } from '../tools/persian-search';
import { extractStatedAllergens } from '../intent/allergen-extractor';
import { t, Locale, resolveLocale } from '../i18n/template-registry';
import { BehavioralContextSnapshot } from '../ai-core.types';

/**
 * GroundedReplyService (AI-GROUNDED-ASSISTANT).
 *
 * Turns the chat assistant into a GROUNDED, ALLERGY-SAFE responder whose answers come from the REAL
 * recipe corpus. Provider-agnostic and deterministic: it makes NO model call (no AI_MODEL_PROVIDER
 * dependency), so the same safe set works for the deterministic reply NOW and for a future live LLM.
 *
 * THE HARD ALLERGY GATE (the non-negotiable safety contract):
 *   - It runs SERVER-SIDE, BEFORE any reply is composed and BEFORE anything reaches a model.
 *   - It REUSES the audited recommendation safety primitives — `assessRecipeFit` +
 *     `analyzeRecipeIntegrity` — over the SAME `FIT_SELECT` recipe shape the recommendation
 *     candidate-generator loads, and reads the SAME reconciled declared-allergy set
 *     (`getLivingUserProfile` → assessRecipeFit's `profile.reconciled.dimensions.allergies`). It does
 *     NOT reimplement or modify that logic.
 *   - A recipe whose declared∪derived allergens intersect the user's declared/reconciled allergy set is
 *     HARD-dropped (`recommendation === 'avoid_allergen'`) and NEVER surfaced.
 *   - If the safe allergy set cannot be ESTABLISHED (the living profile cannot be loaded), we surface
 *     NOTHING (`unsafe_set_unavailable`) — never guess a safe set.
 *   - No fabrication: only real recipes that exist in the DB. Empty safe set → an honest "no safe
 *     match" reply, never filler, never an invented recipe.
 *
 * Declared allergens are NEVER placed into a model prompt (the live augmentation is built from the
 * already-filtered SAFE set only). Filtering happens here, in our code — not in the prompt.
 */

// Mirror the recommendation candidate-generator's FIT_SELECT EXACTLY so the SAME audited fit/allergen
// derivation runs on the SAME recipe shape (declared `allergens` + ingredient→dictionary `allergens`).
const FIT_SELECT = {
  id: true, title: true, diet: true, difficulty: true, cookingTime: true, allergens: true, categories: true, region: true, containsPork: true,
  ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } },
} as const;

const RETRIEVE_LIMIT = 12; // candidates pulled from the corpus before the HARD allergy gate
const SURFACE_LIMIT = 5; // safe recipes actually shown

// Recipe difficulty is stored in English in the corpus; render it per locale.
const DIFFICULTY: Record<Locale, Record<string, string>> = {
  fa: { easy: 'آسان', medium: 'متوسط', hard: 'سخت' },
  nl: { easy: 'makkelijk', medium: 'gemiddeld', hard: 'moeilijk' },
  en: { easy: 'easy', medium: 'medium', hard: 'hard' },
};

export type GroundingStatus = 'ok' | 'empty' | 'unsafe_set_unavailable';

export interface SafeRecipe {
  id: string;
  title: string;
  cookingTime: number | null;
  difficulty: string | null;
  /** the non-allergen fit recommendation ('great_fit' | 'ok' | 'caution'); never 'avoid_allergen'. */
  fit: string;
}

export interface GroundingResult {
  safeRecipes: SafeRecipe[];
  /** titles of RETRIEVED recipes HARD-dropped by the allergy gate — used by the live OUTPUT gate. */
  unsafeTitles: string[];
  groundingStatus: GroundingStatus;
  retrievedCount: number;
  droppedForAllergy: number;
}

export interface LiveOutputVerdict {
  safe: boolean;
  reason: string | null;
}

@Injectable()
export class GroundedReplyService {
  private readonly logger = new Logger(GroundedReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
    private readonly tools: ToolRegistryService,
  ) {}

  /**
   * Build the allergy-safe grounding for a chat prompt. Deterministic, no model call.
   * Order matters: establish the safe allergy set FIRST, then retrieve, then HARD-filter.
   */
  async buildGrounding(userId: string, prompt: string, snapshot?: BehavioralContextSnapshot): Promise<GroundingResult> {
    // 1) establish the safe allergy set FIRST. If the living profile cannot be loaded we CANNOT
    //    establish a safe set → surface NOTHING (mirrors candidate-generator: throws/null → return []).
    let profile: unknown;
    try {
      profile = await this.profiles.getLivingUserProfile(userId);
    } catch (err) {
      this.logger.warn(`living profile unavailable; surfacing nothing (unsafe_set_unavailable): ${err instanceof Error ? err.name : 'error'}`);
      return this.emptyResult('unsafe_set_unavailable', 0);
    }
    if (!profile) return this.emptyResult('unsafe_set_unavailable', 0);

    // 2) retrieve candidates via the REAL read-only `search_recipes` tool (isPublic; title/description/
    //    ingredient `contains`, insensitive). Never fabricates; returns sanitized {id,...} objects.
    const ids = await this.retrieveCandidateIds(userId, prompt, snapshot);
    if (ids.length === 0) return this.emptyResult('empty', 0);

    // 3) load the FULL fit shape so the audited gate sees declared + ingredient-dictionary allergens.
    let pool: any[];
    try {
      pool = await this.prisma.recipe.findMany({ where: { id: { in: ids }, isPublic: true, status: 'active' }, select: FIT_SELECT }); // advisor audit: exclude unreviewed UGC
    } catch (err) {
      // retrieval/load failed → we cannot guarantee a safe set → surface nothing honestly.
      this.logger.warn(`candidate load failed; surfacing nothing: ${err instanceof Error ? err.name : 'error'}`);
      return this.emptyResult('empty', ids.length);
    }

    // 4) HARD allergy gate — REUSE assessRecipeFit + analyzeRecipeIntegrity. `avoid_allergen` is NEVER
    //    surfaced. We iterate ALL retrieved candidates (so the gate provably applies to every one), in
    //    retrieval (relevance) order, then surface at most SURFACE_LIMIT safe ones.
    const byId = new Map<string, any>(pool.map((r) => [r.id, r]));
    const safe: SafeRecipe[] = [];
    const unsafeTitles: string[] = [];
    let dropped = 0;
    for (const id of ids) {
      const r = byId.get(id);
      if (!r) continue;
      const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
      const fit = assessRecipeFit(r, profile, derived);
      // HARD gate honors the FULL verdict of the audited primitive: declared allergens (avoid_allergen) AND
      // observance constraints (avoid_constraint = pork under halal/kosher/no_pork) are NEVER surfaced — not in a
      // recommendation, not in the inline recipe delivery. Both push the title to unsafeTitles so the live OUTPUT
      // gate (screenLiveOutput) also discards a model reply that names one.
      if (fit.recommendation === 'avoid_allergen' || fit.recommendation === 'avoid_constraint') {
        dropped += 1;
        if (typeof r.title === 'string' && r.title.trim()) unsafeTitles.push(r.title.trim());
        continue;
      }
      safe.push({
        id: String(r.id),
        title: String(r.title ?? ''),
        cookingTime: typeof r.cookingTime === 'number' ? r.cookingTime : null,
        difficulty: typeof r.difficulty === 'string' ? r.difficulty : null,
        fit: fit.recommendation,
      });
    }

    return {
      safeRecipes: safe.slice(0, SURFACE_LIMIT),
      unsafeTitles,
      groundingStatus: safe.length ? 'ok' : 'empty',
      retrievedCount: ids.length,
      droppedForAllergy: dropped,
    };
  }

  /**
   * Deterministic composer — render the SAFE set, or an HONEST no-safe-match / unavailable message.
   * Carries the AI disclosure + non-medical hedge; cites the recipe corpus as the grounding source;
   * makes no nutrition/medical/diet claims; never invents a recipe.
   */
  composeDeterministicReply(grounding: GroundingResult, locale: Locale = 'fa'): string {
    if (grounding.groundingStatus === 'unsafe_set_unavailable') {
      return t('unsafe_set_unavailable', locale);
    }
    if (grounding.groundingStatus !== 'ok' || grounding.safeRecipes.length === 0) {
      // Only frame the empty result as an ALLERGY filter when something was actually dropped for allergy;
      // otherwise (gibberish / no understood term) a neutral clarifier avoids implying a safety block.
      return grounding.droppedForAllergy > 0 ? t('empty_allergy_filtered', locale) : t('empty_neutral', locale);
    }
    const lines = grounding.safeRecipes.map((r) => {
      const time = r.cookingTime ? t('recipe_minutes', locale, { n: r.cookingTime }) : t('recipe_time_unknown', locale);
      const d = r.difficulty ? (DIFFICULTY[locale][r.difficulty.toLowerCase()] ?? r.difficulty) : '';
      const diff = d ? ` | ${d}` : '';
      return `**${r.title}**\n⏱ ${time}${diff}`;
    });
    const n = grounding.safeRecipes.length;
    const footer = grounding.droppedForAllergy > 0
      ? t('recipe_list_footer_allergy', locale, { n })
      : t('recipe_list_footer_plain', locale, { n });
    return `${t('ai_disclosure_header', locale)}\n\n${t('recipe_list_intro', locale)}\n\n${lines.join('\n\n')}\n\n${footer}`;
  }

  /** The user's template locale (from User.locale, BCP-47), default fa. Safe-fails to fa on any read error. */
  async getLocale(userId: string): Promise<Locale> {
    try {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
      return resolveLocale(u?.locale);
    } catch {
      return 'fa';
    }
  }

  /**
   * LIVE rails — grounding injection. Builds the prompt a live model would see: a system instruction +
   * ONLY the already-filtered SAFE recipe set + the user's verbatim question. Declared allergens are
   * NEVER included. The user's raw prompt is preserved verbatim so the orchestrator's inbound guards
   * still inspect it. (Used only when chat-live is explicitly enabled; OFF by default.)
   */
  buildLivePrompt(prompt: string, grounding: GroundingResult): string {
    const safeList = grounding.safeRecipes.length
      ? grounding.safeRecipes.map((r, i) => `${i + 1}. ${r.title}${r.cookingTime ? ` (${r.cookingTime}m)` : ''}`).join('\n')
      : '(none)';
    return [
      'You are Garnish’s AI cooking assistant. Garnish specializes in PERSIAN/Iranian cuisine. Reply in Persian (fa) — warm, natural, and concise.',
      '',
      'STYLE (this is what makes you feel like a real assistant, not a bot):',
      '- Greet/introduce yourself ONLY on the very first message. If the CONVERSATION below already has earlier turns, DO NOT say «سلام» or re-introduce yourself — just answer.',
      '- Be confident. Do NOT over-apologize or say you «made a mistake». If you can’t do something, state it in one calm sentence and offer the next best thing.',
      '',
      'GROUNDING (non-negotiable):',
      '- You may ONLY name or recommend recipes that appear in the SAFE RECIPES list below. NEVER invent a recipe or name a dish that is not in the list.',
      '- That list was already filtered for THIS user’s allergies server-side — treat it as the only safe options.',
      '',
      'HOW TO ANSWER WELL (this is what makes you feel intelligent, not robotic):',
      '- If the SAFE RECIPES genuinely fit the request, recommend the best 2–4 with a short, specific reason each.',
      '- If they only PARTLY fit (e.g. the user asked for «تند»/spicy, «سریع»/quick, «پرکالری»/«سبک», or a specific style but the list isn’t filtered that way), be HONEST: say you can’t filter exactly by that, then offer the closest options AND a concrete tip to adapt. NEVER claim a dish is spicy/quick/light/etc. when it isn’t — and NEVER present the SAME dish as matching two OPPOSITE requests (e.g. high-calorie and light).',
      '- FULL RECIPE / STEPS: you can recommend dishes and give brief tips, but the complete step-by-step recipe and exact amounts live on each dish’s PAGE in the app. If the user asks for the full recipe/«دستور پخت» of a dish that was mentioned, tell them they can open THAT dish’s page for the complete recipe (name the dish). Do NOT say you «don’t have it» and do NOT silently switch to a different dish.',
      '- If the user asks for NON-Persian / foreign food, say warmly that Garnish focuses on Persian cuisine and offer a Persian alternative — do NOT list unrelated Persian dishes as if they were the foreign dish.',
      '- If the SAFE RECIPES list is «(none)» or none of them fit, do NOT list unrelated dishes. Say you couldn’t find a good match and ask ONE short clarifying question (an ingredient or a vibe).',
      '- Use the earlier turns to understand follow-ups (e.g. «ایرانی باشه» after «غذای تند» = a SPICY Iranian dish). Don’t repeat the same list mechanically.',
      '- No medical, dietary, diagnosis, or nutrition claims.',
      '',
      'SAFE RECIPES:',
      safeList,
      '',
      `CONVERSATION + CURRENT MESSAGE:\n${prompt}`,
    ].join('\n');
  }

  /**
   * LIVE rails — output allergy-safety gate. Run AFTER the model produces text and BEFORE it is
   * surfaced. Discards (→ fall back to the deterministic safe reply) any output that:
   *   - mentions a token from the user's reconciled declared-allergy set (read from the SAME source
   *     assessRecipeFit uses — not a reimplementation of the filter), or
   *   - names a recipe that was retrieved for this query but HARD-dropped by the allergy gate.
   * Fails CLOSED: if the allergy set cannot be read, the live output is discarded.
   */
  async screenLiveOutput(userId: string, modelText: string, grounding: GroundingResult): Promise<LiveOutputVerdict> {
    const text = String(modelText ?? '');
    if (!text.trim()) return { safe: false, reason: 'empty_output' };

    let allergySet: string[];
    try {
      const profile: any = await this.profiles.getLivingUserProfile(userId);
      // SAME accessor assessRecipeFit reads — the reconciled, safety-critical declared-allergy set.
      allergySet = toStringArray(profile?.reconciled?.dimensions?.['allergies']?.reconciledValue).map((a) => a.toLowerCase());
    } catch {
      return { safe: false, reason: 'allergy_set_unavailable' }; // fail closed
    }

    const lowered = text.toLowerCase();
    // (a) literal match of the stored token/value.
    if (allergySet.some((a) => looseMatch(lowered, a) || lowered.includes(a))) {
      return { safe: false, reason: 'declared_allergen_in_output' };
    }
    // (b) named a recipe HARD-dropped for this user's allergy (most specific reason).
    if (grounding.unsafeTitles.some((t) => t && lowered.includes(t.toLowerCase()))) {
      return { safe: false, reason: 'unsafe_recipe_named' };
    }
    // (c) NAME-EXPANDED allergen match — the output may NAME «گردو» while the declared set holds the canonical
    //     token «nut». Reuse the AUDITED extractor (whole-word, fa/nl/en, alias-aware) on the output and intersect
    //     by token, so a hallucinated allergen mention can't slip through just because it used a Persian/Dutch name.
    const declaredTokens = new Set(allergySet.flatMap((a) => [a, ...extractStatedAllergens(a).map((x) => x.token)]));
    if (extractStatedAllergens(text).some((a) => declaredTokens.has(a.token))) {
      return { safe: false, reason: 'declared_allergen_named_in_output' };
    }
    return { safe: true, reason: null };
  }

  /**
   * The user's reconciled DECLARED allergy set — the SAME accessor `assessRecipeFit` / `screenLiveOutput`
   * read. Returned so the substitution flow can pass it as `avoidAllergens` (a substitution must never offer
   * a declared allergen). Returns `null` when the living profile cannot be established (fail-closed signal:
   * the caller must NOT proceed with an unverified-safety answer); `[]` means a known profile with no allergies.
   */
  async getDeclaredAllergens(userId: string): Promise<string[] | null> {
    let profile: any;
    try {
      profile = await this.profiles.getLivingUserProfile(userId);
    } catch {
      return null;
    }
    if (!profile) return null;
    return toStringArray(profile?.reconciled?.dimensions?.['allergies']?.reconciledValue)
      .map((a) => a.trim())
      .filter(Boolean);
  }

  /**
   * DELIVER the recipe: fetch a recipe's ACTUAL ingredients (with amounts) + ordered cooking steps from the GRIS
   * blob, so the chat can give the real recipe inline instead of «go to the page». PUBLISHED-gated (isPublic +
   * active). The recipe is already allergy-safe (the caller passes an id from `buildGrounding`'s filtered set).
   * Steps/amounts come from the DB — never the model — so quantities are exact (deterministic-first). Returns null
   * when not found / unpublished / it has no usable content.
   */
  async getRecipeContent(recipeId: string): Promise<{
    title: string;
    ingredients: { name: string; amount: string | null }[];
    steps: { title: string; detail: string | null }[];
  } | null> {
    let r: any;
    try {
      r = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { title: true, isPublic: true, status: true, gris: true, ingredients: { select: { name: true, amount: true } } },
      });
    } catch {
      return null;
    }
    if (!r || r.isPublic !== true || r.status !== 'active') return null; // PUBLISHED gate
    const gris = (r.gris ?? {}) as any;
    const rawSteps = Array.isArray(gris.steps) ? gris.steps : [];
    const steps = rawSteps
      .map((s: any, i: number) => ({
        order: typeof s?.order === 'number' ? s.order : i + 1,
        title: String(s?.title ?? '').trim(),
        // one short cue from the GRIS step so it reads like guidance, not just a label
        detail: [s?.doneness, s?.sees, s?.tip].map((x: any) => (typeof x === 'string' ? x.trim() : '')).find(Boolean) || null,
      }))
      .filter((s: any) => s.title)
      .sort((a: any, b: any) => a.order - b.order)
      .map((s: any) => ({ title: s.title, detail: s.detail }));
    const ingredients = (r.ingredients ?? [])
      .map((ing: any) => ({ name: String(ing?.name ?? '').trim(), amount: ing?.amount != null ? String(ing.amount).trim() : null }))
      .filter((x: any) => x.name);
    if (!steps.length && !ingredients.length) return null;
    return { title: String(r.title ?? ''), ingredients, steps };
  }

  /**
   * Look up an ingredient's per-100g nutrition (USDA-sourced data in the dictionary) for a factual «کالری برنج»
   * answer. Alias-first with a raw fallback; prefer an exact/confident match that actually carries nutrition
   * data, else the shortest. Returns null when nothing is found — the caller stays honest, never invents a number.
   */
  async getIngredientNutrition(term: string): Promise<{ name: string; per100g: Record<string, number> } | null> {
    const lookups = [aliasIngredient(term), term].filter((v, i, a) => v && a.indexOf(v) === i);
    for (const lookup of lookups) {
      let rows: any[];
      try {
        rows = await this.prisma.ingredient.findMany({
          where: { OR: [{ nameFa: { contains: lookup } }, { nameEn: { contains: lookup } }] },
          take: 25,
          select: { nameFa: true, nameEn: true, code: true, nutritionPer100g: true },
        });
      } catch {
        return null;
      }
      const withNutri = rows.filter((r) => r?.nutritionPer100g && typeof r.nutritionPer100g === 'object');
      if (!withNutri.length) continue;
      const byLen = (a: any, b: any) => (foldPersian(a?.nameFa).length || 9999) - (foldPersian(b?.nameFa).length || 9999);
      const exact = withNutri.find((r) => [r.nameFa, r.nameEn].some((n) => n && foldPersian(n) === foldPersian(lookup)));
      const confident = withNutri.filter((r) => [r.nameFa, r.nameEn].some((n) => isConfidentIngredientMatch(lookup, n))).sort(byLen);
      const best = exact || confident[0] || [...withNutri].sort(byLen)[0];
      const name = best.nameFa || best.nameEn || best.code;
      return { name, per100g: best.nutritionPer100g as Record<string, number> };
    }
    return null;
  }

  private async retrieveCandidateIds(userId: string, prompt: string, snapshot?: BehavioralContextSnapshot): Promise<string[]> {
    const tool = this.tools.getTool('search_recipes');
    if (!tool) return [];
    try {
      const ctx = { userId, snapshot: (snapshot ?? ({} as BehavioralContextSnapshot)) };
      const out: any = await tool.handler({ query: prompt, limit: RETRIEVE_LIMIT }, ctx);
      const results: any[] = Array.isArray(out?.results) ? out.results : [];
      return results.map((x) => String(x?.id ?? '')).filter(Boolean);
    } catch (err) {
      this.logger.warn(`recipe retrieval failed: ${err instanceof Error ? err.name : 'error'}`);
      return [];
    }
  }

  private emptyResult(status: GroundingStatus, retrievedCount: number): GroundingResult {
    return { safeRecipes: [], unsafeTitles: [], groundingStatus: status, retrievedCount, droppedForAllergy: 0 };
  }
}
