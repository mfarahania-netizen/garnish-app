import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { assessRecipeFit } from '../../recipes/intelligence/recipe-fit';
import { analyzeRecipeIntegrity } from '../../recipes/intelligence/recipe-integrity';
import { looseMatch, toStringArray } from '../tools/grounding-utils';
import { foldPersian, aliasIngredient, isConfidentIngredientMatch, parseSearchQuery } from '../tools/persian-search';
import { extractStatedAllergens } from '../intent/allergen-extractor';
import { t, Locale, resolveLocale } from '../i18n/template-registry';
import { BehavioralContextSnapshot } from '../ai-core.types';
import { PUBLISHED_RECIPE_WHERE } from '../../recipes/recipe-visibility';
import { computeDishNutrition, buildDishInputs, DishDictRow } from '../../recipes/intelligence/dish-nutrition';

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

// ubiquitous seasonings/condiments — filtered out of the model-visible «key ingredients» so the DISTINGUISHING
// mains (لپه/گوشت/…) surface instead of the spice rack that opens almost every recipe's ingredient list.
const SEASONING_RE = /نمک|فلفل|زردچوبه|روغن|آبلیمو|^آب$|^آب /;

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
  /** 'persian' | 'international' — carried so the live model can frame a foreign dish correctly, not deny it. */
  region: string | null;
  /** a few key ingredient names — so the model can match an INGREDIENT request («با لپه») to a dish whose TITLE
   *  doesn't show it (e.g. «قیمه سیب‌زمینی» contains لپه). Without these the model is blind to contents. */
  keyIngredients: string[];
  /** the non-allergen fit recommendation ('great_fit' | 'ok' | 'caution'); never 'avoid_allergen'. */
  fit: string;
}

/** What the assistant KNOWS about this user — read from UserBehaviorProfile + the UserFact memory. NOT a safety
 *  input (allergies stay in the HARD gate); this is preference/personality so the AI feels like it knows you. */
export interface UserModelContext {
  dislikes: string[];
  favorites: string[];
  skill: string | null;
  /** the user's declared GOALS («سالم‌تر خوردن», «یادگیری آشپزی») from onboarding — why they're here. */
  goals: string[];
  /** durable user-stated facts («گیاهی‌ام», «۲ بچه دارم») — the "remember this" memory. */
  facts: { key: string; value: string }[];
}

export interface GroundingResult {
  safeRecipes: SafeRecipe[];
  /** titles of RETRIEVED recipes HARD-dropped by the allergy gate — used by the live OUTPUT gate. */
  unsafeTitles: string[];
  groundingStatus: GroundingStatus;
  retrievedCount: number;
  droppedForAllergy: number;
  /** the user-model (dislikes/favorites/skill/memory) — optional; absent on empty/unsafe grounding. */
  userModel?: UserModelContext;
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

    // load the user model ONCE (preference/memory — NOT safety) so it can also DROP disliked dishes + feed the prompt.
    // pass the LIVING profile so dislikes come from the authoritative `dietary.hard_dislikes` (what onboarding writes).
    const userModel = await this.loadUserModel(userId, profile);
    // PREFERENCE filter (soft, not a safety claim): a disliked ingredient is dropped from what we SURFACE — UNLESS
    // the user explicitly asked for it THIS turn (then keep it; the model acknowledges «معمولاً دوست نداری ولی…»).
    const requested = new Set(parseSearchQuery(prompt).include.map((t) => foldPersian(t)));
    const activeDislikes = userModel.dislikes.map((d) => foldPersian(d)).filter((d) => d.length >= 2 && !requested.has(d));

    // 4) HARD allergy gate — REUSE assessRecipeFit + analyzeRecipeIntegrity. `avoid_allergen` is NEVER
    //    surfaced. We iterate ALL retrieved candidates (so the gate provably applies to every one), in
    //    retrieval (relevance) order, then surface at most SURFACE_LIMIT safe ones.
    const byId = new Map<string, any>(pool.map((r) => [r.id, r]));
    const safe: SafeRecipe[] = [];
    const unsafeTitles: string[] = [];
    let dropped = 0;
    let droppedDislike = 0;
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
      // PREFERENCE drop (soft): contains a DISLIKED ingredient the user did NOT explicitly ask for → don't surface.
      // NOT pushed to unsafeTitles (it is a preference, never a safety claim — the output gate must not block on it).
      if (activeDislikes.length) {
        const hay = foldPersian([r.title, ...(Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => i?.name) : [])].join(' '));
        if (activeDislikes.some((d) => hay.includes(d))) { droppedDislike += 1; continue; }
      }
      safe.push({
        id: String(r.id),
        title: String(r.title ?? ''),
        cookingTime: typeof r.cookingTime === 'number' ? r.cookingTime : null,
        difficulty: typeof r.difficulty === 'string' ? r.difficulty : null,
        region: typeof r.region === 'string' ? r.region : null,
        // distinguishing ingredients only — recipes list seasonings FIRST (نمک/فلفل/روغن…), so a naive «first 6»
        // would hide the real mains (a «با لپه» dish shows spices, not لپه). Filter the ubiquitous seasonings so the
        // model sees what actually defines the dish.
        keyIngredients: Array.isArray(r.ingredients)
          ? r.ingredients.map((i: any) => String(i?.name ?? '').trim()).filter((n: string) => n && !SEASONING_RE.test(n)).slice(0, 8)
          : [],
        fit: fit.recommendation,
      });
    }

    return {
      safeRecipes: safe.slice(0, SURFACE_LIMIT),
      unsafeTitles,
      groundingStatus: safe.length ? 'ok' : 'empty',
      retrievedCount: ids.length,
      droppedForAllergy: dropped,
      userModel,
    };
  }

  /**
   * Load what the assistant KNOWS about this user — preference/personality, NOT safety (allergies stay in the HARD
   * gate). Reads UserBehaviorProfile (dislikes/favorites/skill) + the UserFact «remember this» memory. Best-effort:
   * any failure or empty data → an empty model (the assistant just won't personalise; it never breaks the turn).
   */
  private async loadUserModel(userId: string, profile?: any): Promise<UserModelContext> {
    const empty: UserModelContext = { dislikes: [], favorites: [], skill: null, goals: [], facts: [] };
    if (!userId) return empty;
    const arr = (s: unknown): string[] => {
      try { const a = JSON.parse(typeof s === 'string' ? s : '[]'); return Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean) : []; } catch { return []; }
    };
    // AUTHORITATIVE dislike source = the living profile's declared `dietary.hard_dislikes` — what ONBOARDING writes
    // (the «چیزی که هیچ‌وقت نمی‌خوای؟» step) and what `assessRecipeFit` reads. The UserBehaviorProfile field is a
    // SEPARATE store onboarding does NOT populate, so reading only it made the filter inert for real users.
    const hardDislikes = (() => {
      const v = profile?.declared?.dimensions?.['dietary.hard_dislikes']?.value;
      return Array.isArray(v) ? v.map((x: any) => String(x).trim()).filter(Boolean) : typeof v === 'string' && v.trim() ? [v.trim()] : [];
    })();
    // DECLARED GOALS from onboarding («دنبالِ چی هستی؟» → goals.primary) — mapped to plain Persian so the assistant
    // can gently tailor to WHY the user is here (never as a medical claim).
    const GOAL_FA: Record<string, string> = { eat_healthier: 'سالم‌تر و سبک‌تر خوردن', learn_cooking: 'یاد گرفتنِ آشپزی', save_time: 'صرفه‌جویی در زمان', save_money: 'مدیریتِ هزینه', more_energy: 'انرژی و تعادل' };
    const goals = (() => {
      const v = profile?.declared?.dimensions?.['goals.primary']?.value;
      const ids = Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? [v.trim()] : []);
      return [...new Set(ids.map((id: any) => GOAL_FA[String(id)]).filter(Boolean))].slice(0, 4) as string[];
    })();
    try {
      const [bp, facts] = await Promise.all([
        this.prisma.userBehaviorProfile.findFirst({ where: { userId }, select: { dislikedIngredients: true, dislikedFoods: true, favoriteFoods: true, favoriteIngredients: true, cookingSkill: true } }).catch(() => null),
        this.prisma.userFact.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 10, select: { key: true, value: true } }).catch(() => [] as { key: string; value: unknown }[]),
      ]);
      return {
        dislikes: [...new Set([...hardDislikes, ...arr(bp?.dislikedIngredients), ...arr(bp?.dislikedFoods)])].slice(0, 12),
        favorites: [...new Set([...arr(bp?.favoriteFoods), ...arr(bp?.favoriteIngredients)])].slice(0, 12),
        skill: typeof bp?.cookingSkill === 'string' && bp.cookingSkill.trim() ? bp.cookingSkill.trim() : null,
        goals,
        facts: (facts ?? []).map((f) => ({ key: String(f.key), value: typeof f.value === 'string' ? f.value : JSON.stringify(f.value) })).filter((f) => f.key && f.value),
      };
    } catch {
      return { ...empty, dislikes: hardDislikes.slice(0, 12), goals };
    }
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
      ? grounding.safeRecipes.map((r, i) => `${i + 1}. ${r.title}${r.region ? ` — ${r.region}` : ''}${r.cookingTime ? ` (${r.cookingTime}m)` : ''}${r.keyIngredients?.length ? ` — مواد: ${r.keyIngredients.join('، ')}` : ''}`).join('\n')
      : '(none)';
    // PERSONALIZATION — what we KNOW about this user (preference/memory, NOT safety; allergies are gated separately).
    const um = grounding.userModel;
    const userLines: string[] = [];
    if (um?.facts.length) userLines.push(`- یادداشت‌های ماندگار دربارهٔ این کاربر (به‌خاطر بسپار و حتماً رعایت کن): ${um.facts.map((f) => `${f.key}=${f.value}`).join('؛ ')}`);
    if (um?.dislikes.length) userLines.push(`- از این‌ها بدش می‌آید — پیشنهاد نده مگر خودش بخواهد: ${um.dislikes.join('، ')}`);
    if (um?.favorites.length) userLines.push(`- این‌ها را دوست دارد — در صورت تناسب اولویت بده: ${um.favorites.join('، ')}`);
    if (um?.skill) userLines.push(`- سطح آشپزی‌اش: ${um.skill} (سختی و لحن را متناسب کن)`);
    if (um?.goals?.length) userLines.push(`- هدفش از اپ: ${um.goals.join('، ')} — هرجا طبیعی بود، انتخاب‌ها و لحنت را به این هدف نزدیک کن (مثلاً «چون دنبالِ سالم‌تر خوردنی، این سبک‌ترها رو دارم…»)، بدونِ ادعای پزشکی.`);
    const userBlock = userLines.length
      ? ['WHAT YOU KNOW ABOUT THIS USER (personalization — use it so you feel like you genuinely KNOW them; reference it naturally e.g. «چون گیاهی هستی…». Allergies are handled separately by the safety filter, do NOT mention allergy filtering here):', ...userLines, '']
      : [];
    return [
      'You are Garnish’s AI cooking assistant. Garnish offers BOTH Persian/Iranian AND many international recipes. Reply in Persian (fa) — warm, natural, and concise.',
      '',
      'STYLE (this is what makes you feel like a real assistant, not a bot):',
      '- Greet/introduce yourself ONLY on the very first message. If the CONVERSATION below already has earlier turns, DO NOT say «سلام» or re-introduce yourself — just answer.',
      '- Be confident. Do NOT over-apologize or say you «made a mistake». If you can’t do something, state it in one calm sentence and offer the next best thing.',
      '',
      'GROUNDING (non-negotiable):',
      '- You may ONLY name or recommend recipes that appear in the SAFE RECIPES list below. NEVER invent a recipe or name a dish that is not in the list.',
      '- That list was already filtered for THIS user’s allergies server-side — treat it as the only safe options.',
      '- The list was RETRIEVED as matches for the user’s request, and each line shows the dish’s key ingredients (مواد). TRUST it: recommend FROM the list, and USE the ingredients to match an ingredient request — e.g. for «با لپه» pick a dish whose مواد include لپه even if its title doesn’t (قیمه). If the list is non-empty, NEVER say you «don’t have» what they asked — the match is there.',
      '',
      'HOW TO ANSWER WELL (this is what makes you feel intelligent, not robotic):',
      '- DEFAULT to offering 3–4 options (the user wants choice — do NOT give just one unless they asked for one). Recommend DECISIVELY, like a chef who knows the menu, each with a short specific reason (a key ingredient or the time). If fewer than 3 genuinely fit, give fewer — but NEVER repeat the same dish to pad the list (no duplicates). Don’t hedge.',
      '- If they only PARTLY fit (e.g. the user asked for «تند»/spicy, «سریع»/quick, «پرکالری»/«سبک», or a specific style but the list isn’t filtered that way), be HONEST: say you can’t filter exactly by that, then offer the closest options AND a concrete tip to adapt. NEVER claim a dish is spicy/quick/light/etc. when it isn’t — and NEVER present the SAME dish as matching two OPPOSITE requests (e.g. high-calorie and light).',
      '- FULL RECIPE — CRITICAL: you are given ONLY dish titles, regions, and times — NOT ingredients, amounts, or steps. You must NEVER write an ingredient list, a quantity, or a cooking step yourself: you don’t have the real data and would be INVENTING it (forbidden). Instead, the SYSTEM fetches and shows the real recipe. So when the user wants the full recipe, invite them to say «دستورِ [نام غذا] رو بده» (e.g. «بگو «دستورِ سوپ شیر رو بده» تا دستورِ کاملش برات بیاد») — naming the dish is what makes the real recipe appear. Never tell them to «open a page», never say you «don’t have it», never invent ingredients, never silently switch dishes.',
      '- The SAFE RECIPES include both Persian AND international dishes (the «— international» tag marks a foreign one). If the user asks for foreign / non-Persian food and matching dishes are in the list, recommend them directly and confidently. NEVER claim Garnish «only has Persian food» or lacks a whole cuisine — it has many international recipes. Only if the list has NOTHING fitting the request, say you couldn’t find a match for THIS specific request.',
      '- If the SAFE RECIPES list is «(none)» or none of them fit, do NOT list unrelated dishes. Say you couldn’t find a good match and ask ONE short clarifying question (an ingredient or a vibe).',
      '- VARY your wording every turn — do NOT end every message with the same «بگو دستورِ X رو بده» sentence or «کدومیک؟». Mention the «دستورِ ...» tip only OCCASIONALLY (e.g. once), not on every single reply; often just give the recommendations and stop. Reading the same closing line every turn feels robotic.',
      '- Use the earlier turns to understand follow-ups (e.g. «ایرانی باشه» after «غذای تند» = a SPICY Iranian dish). Don’t repeat the same list mechanically.',
      '- PERSONALIZE with WHAT YOU KNOW ABOUT THIS USER (below, if present): never suggest something they dislike, lean toward their favorites, match their cooking skill, and HONOR the remembered notes (e.g. a note «گیاهی=بله» → suggest ONLY vegetarian dishes). Reference what you remember naturally so they feel known — but don’t recite the whole profile back.',
      '- ⛔ ABSOLUTE RULE — NEVER claim a taste you were not given. The user ASKING for an ingredient does NOT mean they like it. You must NEVER write «دوست داری»، «علاقه داری»، «عاشقشی»، «همیشه می‌خوری»، «خوشت میاد» (or any "you like/love X") about ANY food unless that exact food is listed under «این‌ها را دوست دارد» above. If WHAT YOU KNOW shows NO likes, you simply do NOT know their tastes — present the options NEUTRALLY («این گزینه‌ها رو دارم…»), never assume. If a food is listed as a DISLIKE and they ask for it anyway, say «معمولاً [X] دوست نداری، ولی چون الان خواستی…». Claiming a taste they never told you is a LIE that destroys trust — this is the single most important rule.',
      '- No medical, dietary, diagnosis, or nutrition claims.',
      '',
      ...userBlock,
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
   * The user's structured DIET as an agentic-prompt constraint line (the same UserPreference.diet the planner +
   * assessRecipeFit use). Reuses one read so the agentic path honors vegetarian/vegan exactly like the grounded
   * path did — fixes the regression where turning on the agentic brain dropped diet personalization (a vegetarian
   * user got قرمه‌سبزی/مرغ). null for omnivore/unset. Best-effort: a read error never blocks the turn.
   */
  async getDietConstraint(userId: string): Promise<string | null> {
    try {
      const pref = await this.prisma.userPreference.findUnique({ where: { userId }, select: { diet: true } });
      const diet = String(pref?.diet ?? '').toLowerCase();
      if (diet === 'vegetarian') return 'محدودیتِ غذایی: کاربر گیاه‌خوار (vegetarian) است — هرگز غذای حاویِ گوشت، مرغ، ماهی یا میگو پیشنهاد نده، در غذا نیاور یا در دستور نذار؛ فقط غذای گیاهی.';
      if (diet === 'vegan') return 'محدودیتِ غذایی: کاربر وگان (vegan) است — هرگز غذای حاویِ گوشت، مرغ، ماهی، تخم‌مرغ، لبنیات یا عسل پیشنهاد نده؛ فقط غذای کاملاً گیاهی.';
      return null;
    } catch {
      return null;
    }
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
        select: { title: true, isPublic: true, status: true, gris: true, ingredients: { select: { name: true, amount: true, unit: true } } },
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
      .map((ing: any) => ({
        name: String(ing?.name ?? '').trim(),
        // amount + UNIT together — «۲ پیمانه» not a bare «۲» (a quantity without its unit is meaningless).
        amount: [ing?.amount, ing?.unit].map((v: any) => (v != null ? String(v).trim() : '')).filter(Boolean).join(' ') || null,
      }))
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

  /**
   * Compute a WHOLE DISH's per-serving nutrition («کالریِ قیمه چنده؟») — the capability the amount→gram
   * conversion layer unlocks. Deterministic + grounded: the number comes from the dish's own ingredients
   * (source-locked per-100g × resolved grams), NEVER from a model. Resolves the named dish in the published
   * corpus, prefers the stored per-serving Nutrition row (so the chat matches the meal-plan line), else
   * live-computes via the conversion layer. Returns null when the dish isn't found OR can't be FULLY grounded
   * — so the caller stays honest (it never surfaces a partial/guessed dish total). NO allergy decision here
   * (informational readout of a dish the user named); the safety gate elsewhere governs what is RECOMMENDED.
   */
  async getDishNutrition(term: string): Promise<{ title: string; perServing: Record<string, number>; servings: number; source: 'stored' | 'computed_live' } | null> {
    const cleaned = this.cleanDishTerm(term);
    if (cleaned.length < 2) return null;
    // If the WHOLE cleaned term is itself a dictionary INGREDIENT («برنج»، «عدس»), this is a per-100g question —
    // defer to the ingredient path so we don't compute a same-named DISH («برنج کته») for «کالریِ برنج». A compound
    // DISH name («قورمه سبزی»، «قیمه») does not confidently match a single ingredient, so it proceeds to the dish.
    if (await this.isConfidentIngredientTerm(cleaned)) return null;
    const recipe = await this.resolvePublishedRecipe(cleaned);
    if (!recipe) return null;

    const macros = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
    // 1) prefer the stored per-serving Nutrition row — same number the meal-plan per-day line shows.
    const stored = recipe.nutrition;
    if (stored && stored.calories != null) {
      const perServing: Record<string, number> = {};
      for (const m of macros) if (stored[m] != null) perServing[m] = Number(stored[m]);
      return { title: recipe.title, perServing, servings: Number(recipe.servings) || 0, source: 'stored' };
    }
    // 2) else live-compute from the ingredient amounts via the conversion layer.
    const ids = (recipe.ingredients ?? []).map((i) => i.ingredientId).filter((x): x is string => !!x);
    let dictRows: { id: string; nutritionPer100g: unknown; category: string | null; gramConversions: unknown }[] = [];
    try {
      dictRows = ids.length ? await this.prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true, nutritionPer100g: true, category: true, gramConversions: true } }) : [];
    } catch {
      return null;
    }
    const dictById = new Map<string, DishDictRow>(dictRows.map((d) => [d.id, { nutritionPer100g: d.nutritionPer100g, category: d.category, gramConversions: d.gramConversions }]));
    const { inputs, servings } = buildDishInputs(recipe, dictById);
    const res = computeDishNutrition(inputs, servings);
    if (!res.perServing) return null; // not fully grounded → honest null (the nutrition guard stays)
    return { title: recipe.title, perServing: res.perServing, servings, source: 'computed_live' };
  }

  /** True when the whole cleaned term confidently names a dictionary INGREDIENT (→ answer per-100g, not as a dish). */
  private async isConfidentIngredientTerm(cleaned: string): Promise<boolean> {
    const n = await this.getIngredientNutrition(cleaned).catch(() => null);
    if (!n) return false;
    return foldPersian(n.name) === foldPersian(cleaned) || isConfidentIngredientMatch(cleaned, n.name);
  }

  /** Strip nutrition-question words off a turn, leaving the dish name («قیمه چند کالری داره؟» → «قیمه»). */
  private cleanDishTerm(prompt: string): string {
    const stop = /کالریِ?|کالری‌|چندتا|چند|چقدره?|چنده|داره|دارد|می‌?شه|پروتئینِ?|چربیِ?|کربوهیدرات|فیبر|قند|هر|یه|یک|پرس|وعده|بشقاب|این|اون|همین|اطلاعاتِ?|تغذیه|دارای|نوشته|مقدار|دونه|چه‌قدر|چقد|نفر|سهم/g;
    return String(prompt || '').replace(/‌/g, ' ').replace(stop, ' ').replace(/[؟?.!،,()]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Resolve a published recipe by name (best title match), loading what dish-nutrition needs. */
  private async resolvePublishedRecipe(cleaned: string) {
    const select = {
      id: true, title: true, servings: true, gris: true,
      nutrition: { select: { calories: true, protein: true, carbs: true, fat: true, fiber: true } },
      ingredients: { select: { name: true, ingredientId: true, amount: true, unit: true } },
    } as const;
    const rank = <T extends { title: string }>(rows: T[]): T => {
      const f = foldPersian(cleaned);
      return [...rows].sort((a, b) => {
        const ax = foldPersian(a.title) === f ? 0 : foldPersian(a.title).startsWith(f) ? 1 : 2;
        const bx = foldPersian(b.title) === f ? 0 : foldPersian(b.title).startsWith(f) ? 1 : 2;
        return ax - bx || a.title.length - b.title.length; // best match, then shortest (most specific) title
      })[0];
    };
    try {
      const direct = await this.prisma.recipe.findMany({ where: { ...PUBLISHED_RECIPE_WHERE, title: { contains: cleaned } }, select, take: 8 });
      if (direct.length) return rank(direct);
      // fall back to the longest content token (handles «خورش قیمه» when the title is «قیمه نثار»)
      const token = cleaned.split(/\s+/).filter((t) => t.length >= 2).sort((a, b) => b.length - a.length)[0];
      if (token && token !== cleaned) {
        const byToken = await this.prisma.recipe.findMany({ where: { ...PUBLISHED_RECIPE_WHERE, title: { contains: token } }, select, take: 8 });
        if (byToken.length) return rank(byToken);
      }
    } catch {
      /* DB error → honest null */
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
