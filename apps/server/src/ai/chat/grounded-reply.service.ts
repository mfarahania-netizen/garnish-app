import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { assessRecipeFit } from '../../recipes/intelligence/recipe-fit';
import { analyzeRecipeIntegrity } from '../../recipes/intelligence/recipe-integrity';
import { looseMatch, toStringArray } from '../tools/grounding-utils';
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
  id: true, title: true, diet: true, difficulty: true, cookingTime: true, allergens: true, categories: true, region: true,
  ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } },
} as const;

const RETRIEVE_LIMIT = 12; // candidates pulled from the corpus before the HARD allergy gate
const SURFACE_LIMIT = 5; // safe recipes actually shown

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
      if (fit.recommendation === 'avoid_allergen') {
        dropped += 1;
        if (typeof r.title === 'string' && r.title.trim()) unsafeTitles.push(r.title.trim());
        continue; // declared allergies are NEVER surfaced
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
  composeDeterministicReply(grounding: GroundingResult): string {
    if (grounding.groundingStatus === 'unsafe_set_unavailable') {
      return 'الان نمی‌تونم به‌صورت امن برات پیشنهاد شخصی‌سازی‌شده بدم. لطفاً کمی بعد دوباره تلاش کن.';
    }
    if (grounding.groundingStatus !== 'ok' || grounding.safeRecipes.length === 0) {
      return 'بر اساس رسپی‌های گارنیش، گزینهٔ امنی که با محدودیت‌های اعلام‌شده‌ات بخواند پیدا نشد. می‌تونی مواد یا سؤالت رو طور دیگه‌ای بپرسی.';
    }
    const lines = grounding.safeRecipes.map((r) => {
      const time = r.cookingTime ? `${r.cookingTime} دقیقه` : 'زمان نامشخص';
      const diff = r.difficulty ? ` | ${r.difficulty}` : '';
      return `**${r.title}**\n⏱ ${time}${diff}`;
    });
    const header = '🤖 دستیار هوش مصنوعی گارنیش (اطلاعات عمومی، نه توصیهٔ پزشکی):';
    const intro = 'بر اساس رسپی‌های گارنیش، این گزینه‌ها رو برات پیدا کردم:';
    // honest, non-overclaiming safety note mirroring the audited fit wording (informational, not a guarantee)
    const footer = `📚 این ${grounding.safeRecipes.length} پیشنهاد از پایگاه رسپی گارنیش انتخاب شده و غذاهایی که با آلرژی‌های اعلام‌شده‌ات تداخل داشتند کنار گذاشته شدند (اطلاعاتی است، نه تضمین؛ همیشه فهرست کامل مواد رو بررسی کن).`;
    return `${header}\n\n${intro}\n\n${lines.join('\n\n')}\n\n${footer}`;
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
      'You are Garnish’s Persian cooking assistant. Answer in Persian (fa).',
      'You may ONLY recommend recipes from the SAFE RECIPES list below. Do NOT invent recipes or name any dish outside this list.',
      'These recipes were already filtered for the user’s safety server-side. Give general cooking information only — no medical, dietary, diagnosis, or nutrition claims.',
      '',
      'SAFE RECIPES:',
      safeList,
      '',
      `USER QUESTION: ${prompt}`,
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
    if (allergySet.some((a) => looseMatch(lowered, a) || lowered.includes(a))) {
      return { safe: false, reason: 'declared_allergen_in_output' };
    }
    if (grounding.unsafeTitles.some((t) => t && lowered.includes(t.toLowerCase()))) {
      return { safe: false, reason: 'unsafe_recipe_named' };
    }
    return { safe: true, reason: null };
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
