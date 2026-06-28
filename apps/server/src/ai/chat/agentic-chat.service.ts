import { Injectable, Logger, Inject } from '@nestjs/common';
import { AI_MODEL_PROVIDER, ModelProvider, ToolContext, BehavioralContextSnapshot, ChatTurn } from '../ai-core.types';
import { AgenticLoopService, AgenticTool } from '../agentic/agentic-loop.service';
import { AgenticToolCatalogService } from '../agentic/agentic-tool-catalog.service';
import { AgenticWriteToolsService } from '../agentic/agentic-write-tools.service';
import { GroundedReplyService } from './grounded-reply.service';
import { RecipeSafetyFilterService } from '../../recipes/intelligence/recipe-safety-filter.service';

export interface AgenticChatOutcome {
  /** true only when the loop produced an answer that PASSED the output safety gate. */
  ok: boolean;
  text: string | null;
  /** null when ok; else why we declined ('allergy_unavailable' | 'blocked:<reason>' | 'error' | 'disabled'). */
  reason: string | null;
  toolCalls?: { name: string; arguments: string }[];
  model?: string | null;
}

// Master kill switch (env, loaded from .env by main.ts at boot). OFF by default; when 'true' AND the model supports
// tool-calling, the live chat routes general turns through the agentic brain (behind the same HARD allergy gate).
const FLAG = 'AI_AGENTIC_CHAT_ENABLED';

/**
 * Agentic chat (brain piece 4+5) — the tool-using loop wrapped in the HARD safety gate, behind a flag.
 *
 * SAFETY — the gate is OUTSIDE the model, fail-closed, and REUSES the audited single-source primitives
 * (no new allergy logic here):
 *   1. PRE: getDeclaredAllergens — if the living profile can't load, we DON'T run the model at all.
 *   2. INPUT: every recipe a tool would surface passes through RecipeSafetyFilterService (the same gate the
 *      recommendation rails use) — an avoid_allergen/avoid_constraint recipe is dropped before the model sees it.
 *   3. OUTPUT: the final answer is screened by GroundedReplyService.screenLiveOutput (literal + name-expanded
 *      allergen match + unsafe-title match). A non-safe verdict is BLOCKED — the caller falls back to the
 *      deterministic grounded reply.
 *
 * SAFE BY DEFAULT: returns {ok:false, reason:'disabled'} unless AI_AGENTIC_CHAT_ENABLED=true AND the active
 * model supports tool-calling. Nothing here is on the live chat path until the caller opts in behind the flag.
 */
@Injectable()
export class AgenticChatService {
  private readonly logger = new Logger('AgenticChatService');

  constructor(
    @Inject(AI_MODEL_PROVIDER) private readonly model: ModelProvider,
    private readonly loop: AgenticLoopService,
    private readonly catalog: AgenticToolCatalogService,
    private readonly writeTools: AgenticWriteToolsService,
    private readonly grounded: GroundedReplyService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  /** The agentic brain is usable only when the flag is on AND the active model can call tools. */
  isEnabled(): boolean {
    return String(process.env[FLAG] ?? '').toLowerCase() === 'true' && typeof this.model.generateWithTools === 'function';
  }

  async reply(userId: string, prompt: string, snapshot: BehavioralContextSnapshot, history: ChatTurn[] = []): Promise<AgenticChatOutcome> {
    if (!this.isEnabled()) return { ok: false, text: null, reason: 'disabled' };

    // 1) PRE gate (fail-closed): we must establish the reconciled allergy set before running the model.
    const allergens = await this.grounded.getDeclaredAllergens(userId);
    if (allergens === null) {
      this.logger.warn(`agentic declined: allergy set unavailable for ${userId} (fail-closed)`);
      return { ok: false, text: null, reason: 'allergy_unavailable' };
    }

    const dietLine = await this.grounded.getDietConstraint(userId).catch(() => null); // diet = preference (non-fatal)
    const ctx: ToolContext = { userId, snapshot };

    // UNDERSTAND-then-DO: the weak free model can't be trusted to call tools reliably or to refrain from inventing/
    // faking — and a pure-regex parser is brittle on real Persian («سه شنبه»→«شنبه», «توت» mis-stripped, «۲ کیلو موز
    // گوجه ۱ کیلو» mis-split). So we SPLIT the jobs: the model ONLY understands (→ a structured intent; it normalizes
    // «فردا»/«سه شنبه»/messy item lists, which it's good at), then OUR CODE does the action (finds the real recipe,
    // actually writes, confirms from the DB — it can't fake or invent). A misparse / "other" falls to the chat loop.
    const intent = await this.parseActionIntent(prompt).catch(() => null);
    if (intent && intent.action !== 'other') {
      const done = await this.executeIntent(userId, intent, ctx).catch((e) => {
        this.logger.warn(`executeIntent(${intent.action}) failed: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      });
      if (done) return done;
    }

    const unsafeTitles: string[] = [];
    // read-only tools pass through the allergy gate; reversible WRITE-actions (favorite, shopping-list) act only
    // on the user's own data and auto-execute (no allergy filtering needed — they're user-initiated, not recs).
    const tools = [...this.gatedTools(userId, unsafeTitles), ...this.writeTools.build()];

    // RETRY ONCE on a thrown loop error — the free OpenRouter tool models intermittently return an empty completion
    // (no text, no tool calls); a single retry gives the flake a second chance to actually call the tool (e.g.
    // fill_week_plan) instead of falling back to the grounded reply (which, for a plan request, fakes an unsaved table).
    let result;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await this.loop.run(this.model, {
          systemPrompt: this.systemPrompt(allergens, dietLine),
          userPrompt: prompt,
          history,
          tools,
          ctx,
          maxIterations: 5,
        });
        break;
      } catch (e) {
        this.logger.warn(`agentic loop attempt ${attempt}/2 failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!result) return { ok: false, text: null, reason: 'error' };
    result.text = this.sanitize(result.text); // strip the garbage a weak model emits (founder saw «常务会» / «ته‌چی­n»)

    // ANTI-FAKE write-claim gate: a weak model sometimes says «گذاشتم/اضافه کردم ✅» WITHOUT calling any write tool
    // (founder: «دیزی رو پنجشنبه نهار بذار» → «گذاشتم ✅» but the slot stayed empty; «نزاشتی» → «الان گذاشتم!» again).
    // If the reply claims a successful write but NO write tool actually ran this turn, the claim is fabricated —
    // replace it with an honest ask instead of lying to the user.
    if (this.claimsWriteWithoutDoing(result.text, result.toolCalls)) {
      this.logger.warn('agentic reply claimed a write with no write-tool call — overriding with an honest message');
      return { ok: true, text: 'ببخشید، نتونستم این کارو انجام بدم. یه‌بار دیگه دقیق‌تر بگو — مثلاً «پنجشنبه نهار آبگوشت بذار» یا «خیار رو به لیستِ خرید اضافه کن».', reason: null, toolCalls: result.toolCalls, model: result.model };
    }

    // 3) OUTPUT gate (fail-closed): screen the final answer; only `unsafeTitles` is read by the screen.
    const verdict = await this.grounded.screenLiveOutput(userId, result.text, { unsafeTitles } as never);
    if (!verdict.safe) {
      this.logger.warn(`agentic output BLOCKED (${verdict.reason}) — falling back to grounded reply`);
      return { ok: false, text: null, reason: `blocked:${verdict.reason}` };
    }

    return { ok: true, text: result.text, reason: null, toolCalls: result.toolCalls, model: result.model };
  }

  /**
   * Does this turn clearly mean "build my WHOLE week"? Conservative on purpose: it must mention the week AND a build
   * verb AND a meal-plan word, and must NOT be the «لیستِ خریدِ هفته» action. Single-day adds («شنبه نهار X بذار»)
   * have no «هفته» → they fall through to the model's add_to_meal_plan, untouched.
   */
  private wantsWholeWeekPlan(prompt: string): boolean {
    const p = String(prompt || '').replace(/‌/g, ''); // strip ZWNJ so هفته‌ام / وعده‌ها normalize
    const week = /هفته|هفتگی|۷\s*روز|7\s*روز/.test(p);
    const build = /بچین|بساز|پر\s*کن|کامل\s*کن|درست\s*کن|ردیف\s*کن/.test(p);
    const mealPlan = /برنامه|وعده|غذا|منو/.test(p);
    const shopping = /خرید/.test(p); // «لیستِ خریدِ هفته» is a different deterministic action
    return week && build && mealPlan && !shopping;
  }

  /** Render the REAL saved week (from fill_week_plan) as a clean table. Never invents dishes — only what was saved. */
  private formatWeekPlan(week: { day: string; meals: { meal: string; dish: string }[] }[]): string {
    const fa = (m: string): string => ({ breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده' } as Record<string, string>)[m] ?? m;
    const rows = week.map((d) => {
      const pick = (label: string) => d.meals.find((x) => fa(x.meal) === label)?.dish ?? '—';
      return `| ${d.day} | ${pick('صبحانه')} | ${pick('ناهار')} | ${pick('شام')} |`;
    });
    return [
      'کلِ برنامهٔ هفته‌ات رو چیدم و **ذخیره کردم** ✅ — همین الان توی تبِ «برنامه» می‌بینیش.',
      '',
      '| روز | صبحانه | ناهار | شام |',
      '|---|---|---|---|',
      ...rows,
      '',
      'هر وعده‌ای خواستی، بگو عوضش کنم. می‌خوای **لیستِ خریدش** رو هم برات بسازم؟',
    ].join('\n');
  }

  // Well-known Persian dishes used as the fallback search basis when the ask has no dish term («برای چهارشنبه چی
  // پیشنهاد میدی؟»). search_recipes is grounded, so only the ones that REALLY exist come back.
  private readonly FAMOUS = ['قورمه سبزی', 'قیمه', 'فسنجان', 'زرشک پلو با مرغ', 'باقالی پلو', 'ته چین', 'کباب کوبیده', 'آبگوشت', 'کتلت', 'املت'];

  /** Is this a clear "suggest me a dish / what should I cook" ask? Conservative — never hijacks an action or a recipe-detail request. */
  private wantsDishSuggestion(prompt: string): boolean {
    const p = String(prompt || '').replace(/‌/g, '');
    const cue = /پیشنهاد|چی\s*(بپزم|بپزیم|بخورم|درست\s*کنم|بزنم|سفارش)|چه\s*غذای?ی?|یه\s*غذا|یک\s*غذا|(غذا|خوراک)\s*.{0,8}(بگو|معرفی|بده)|(چند|چن|[\d۰-۹]+)\s*تا\s*غذا|غذای?\s*(محلی|سنتی|ایرانی|مجلسی|سبک|خوب)/.test(p);
    // don't steal write-actions / plan / shopping / recipe-detail / substitution turns — those have their own paths
    const other = /اضافه\s*کن|بذار|بریز|ذخیره\s*کن|حذف\s*کن|برنامه|لیستِ?\s*خرید|دستور|طرزِ?\s*تهیه|مراحل|جایگزین|چطور\s*(بپزم|درست)/.test(p);
    return cue && !other;
  }

  /** Pull a dish/criteria term out of the ask; '' when it's a generic "what do you suggest" (→ famous fallback). */
  private deriveSuggestQuery(prompt: string): string {
    const stop = /برای|چی|چه|چیزی|غذای?ی?|پیشنهادی?|می‌?دی|بده|بهم|داری|بگو|معرفی|کن|یه|یک|خوب|خوشمزه|عالی|بپزم|بپزیم|بخورم|روزِ?|امروز|فردا|پس‌?فردا|شنبه|یکشنبه|دوشنبه|سه‌?شنبه|چهارشنبه|پنج‌?شنبه|جمعه|صبحانه|نهار|ناهار|شام|وعده|الان|واسه|می‌?خوام|دارم/g;
    const q = String(prompt || '').replace(/‌/g, '').replace(stop, ' ').replace(/[؟?.!،,]/g, ' ').replace(/\s+/g, ' ').trim();
    return q.length >= 2 ? q : '';
  }

  /** Retrieve up to 3 REAL, safety-filtered dishes for a suggestion ask — grounded in the catalog, never invented. */
  private async realDishSuggestions(ctx: ToolContext, prompt: string): Promise<{ id: string; title: string }[]> {
    const search = this.catalog.build().find((t) => t.spec.name === 'search_recipes');
    if (!search) return [];
    const derived = this.deriveSuggestQuery(prompt);
    // search the derived term first, then top up from famous dishes — so an occasion/vibe word that is NOT itself a
    // recipe («مجلسی», «محلی») still yields REAL dishes instead of returning nothing and falling through to the model.
    const queries = derived ? [derived, ...this.FAMOUS] : [...this.FAMOUS];
    const seen = new Set<string>();
    const found: { id: string; title: string }[] = [];
    for (const query of queries) {
      if (found.length >= 8) break;
      const res = (await search.execute({ query, limit: 6 }, ctx).catch(() => null)) as { results?: { id?: string; title?: string }[] } | null;
      for (const r of res?.results ?? []) {
        if (r?.id && r?.title && !seen.has(r.id)) { seen.add(r.id); found.push({ id: r.id, title: r.title }); }
      }
    }
    const safe = (await this.safety.filter(ctx.userId, found, 'id')) as { id: string; title: string }[]; // fail-closed
    return safe.slice(0, 3);
  }

  /** Strip garbage tokens a weak model occasionally emits (CJK runs «常务会», soft-hyphen splits «ته‌چی­n», zero-widths). Keeps ZWNJ. */
  private sanitize(text: string): string {
    return String(text ?? '')
      .replace(/[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0e00-\u0e7f]/g, '') // CJK / Hangul / Thai
      .replace(/[\u00ad\u200b\ufeff\ufffd]/g, '') // soft-hyphen, ZWSP, BOM, replacement (NOT \u200c ZWNJ)
      .replace(/[ \t]{3,}/g, ' ')
      .trim();
  }

  /** Render REAL retrieved dishes as suggestions — only titles that exist in the catalog. */
  private formatSuggestions(dishes: { id: string; title: string }[]): string {
    return [
      'چند تا پیشنهادِ خوب از رسپی‌های گارنیش:',
      '',
      ...dishes.map((d, i) => `${i + 1}. **${d.title}**`),
      '',
      'کدومش رو دوست داری؟ بگو تا دستورِ کاملش رو برات بیارم.',
    ].join('\n');
  }

  /** Detect a SINGLE day + meal in the turn (for deterministic single-slot add/remove). Returns null if zero or 2+ days. */
  private detectDayMeal(prompt: string): { day: number; meal: string } | null {
    const p = String(prompt || '').replace(/‌/g, '');
    const DAYS: [RegExp, number][] = [[/یکشنبه/, 1], [/دوشنبه/, 2], [/سهشنبه/, 3], [/چهارشنبه/, 4], [/پنجشنبه/, 5], [/جمعه/, 6], [/شنبه/, 0]];
    const MEALS: [RegExp, string][] = [[/صبح(انه|ونه)/, 'breakfast'], [/ناهار|نهار/, 'lunch'], [/شام/, 'dinner']];
    let day: number | null = null; let matched: RegExp | null = null;
    for (const [re, d] of DAYS) if (re.test(p)) { day = d; matched = re; break; }
    if (day === null || !matched) return null;
    const rest = p.replace(matched, ''); // a 2nd day word remaining → multi-day request, let the model loop it
    for (const [re] of DAYS) if (re.test(rest)) return null;
    let meal: string | null = null;
    for (const [re, m] of MEALS) if (re.test(p)) { meal = m; break; }
    return meal ? { day, meal } : null;
  }

  /** Strip the day/meal/verb/filler words off an add request, leaving the dish term («شنبه شام قورمه سبزی بذار» → «قورمه سبزی»). */
  private extractDish(prompt: string): string {
    const stop = /شنبه|یکشنبه|دوشنبه|سهشنبه|چهارشنبه|پنجشنبه|جمعه|صبحانه|صبحونه|ناهار|نهار|شام|عصرانه|میانوعده|رو|را|برای|بذار|بزار|قرار|بده|اضافه|کن|حذف|بردار|پاک|توی|تو|برنامه|هفتگ\S*|هفته|غذای?ی?|وعده|یه|یک|لطفا|می‌?خوام/g;
    return String(prompt || '').replace(/‌/g, '').replace(stop, ' ').replace(/[؟?.!،,]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Pull the item name(s) out of a shopping turn («سه تا خیار بذار تو لیست خرید» → ["سه تا خیار"]; «ماست و نون رو ...» → ["ماست","نون"]). */
  private extractShoppingItems(prompt: string): string[] {
    const stop = /به|از|توی|تو|لیستِ?|خریدم|خرید|اضافه|بذار|بزار|بریز|بنداز|حذف|بردار|پاک|کنم|کن|رو|را|لطفا|برام|بهم|می‌?خوام|اینو|اینا/g;
    const cleaned = String(prompt || '').replace(/‌/g, '').replace(stop, ' ').replace(/[؟?.!،,]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.split(/\s+و\s+/).map((s) => s.trim()).filter((s) => s.length >= 2);
  }

  /** Find the single best REAL, safety-filtered recipe for a dish term — grounded, for the deterministic single-slot add. */
  private async findOneSafeRecipe(ctx: ToolContext, dishName: string): Promise<{ id: string; title: string } | null> {
    const search = this.catalog.build().find((t) => t.spec.name === 'search_recipes');
    if (!search || dishName.length < 2) return null;
    const res = (await search.execute({ query: dishName, limit: 6 }, ctx).catch(() => null)) as { results?: { id?: string; title?: string }[] } | null;
    const rows = (res?.results ?? []).filter((r): r is { id: string; title: string } => !!(r?.id && r?.title));
    const safe = (await this.safety.filter(ctx.userId, rows, 'id')) as { id: string; title: string }[];
    return safe[0] ?? null;
  }

  /** True when the reply CLAIMS a successful write but no write tool actually ran this turn (the model faked it). */
  private claimsWriteWithoutDoing(text: string, toolCalls: { name: string }[] | undefined): boolean {
    const WRITE = new Set(['add_to_meal_plan', 'remove_from_meal_plan', 'fill_week_plan', 'add_items_to_shopping_list', 'remove_items_from_shopping_list', 'add_recipe_to_shopping_list', 'add_week_to_shopping_list', 'add_favorite', 'remove_favorite', 'set_ingredient_taste']);
    if ((toolCalls ?? []).some((c) => WRITE.has(c.name))) return false; // a real write ran → the claim is legitimate
    return /گذاشتم|گذاشته شد|اضافه کردم|اضافه‌اش کردم|اضافه شد|ذخیره کردم|ذخیره شد|ثبت کردم|ثبت شد|حذف کردم|حذف شد|برداشتم|چیدم و ذخیره/.test(String(text ?? ''));
  }

  // ── UNDERSTAND-then-DO substrate: model UNDERSTANDS (→ structured intent), code DOES (deterministic, grounded) ──

  /** The model's ONLY job here: classify + extract the turn into a small structured intent. It never executes. */
  private async parseActionIntent(prompt: string): Promise<{ action: string; items?: { name?: string; amount?: string }[]; day?: string; meal?: string; dish?: string; query?: string } | null> {
    const DAY = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const today = (new Date().getDay() + 1) % 7;
    const dn = (o: number) => DAY[(today + o) % 7];
    const system = [
      'تو فقط «منظوریابِ» یک اپِ آشپزی هستی. از پیامِ کاربر نیتش را دربیاور و «فقط یک JSON» بده — بدون هیچ توضیح، بدون ```.',
      'قالب: {"action":"...","items":[{"name":"","amount":""}],"day":"","meal":"","dish":"","query":""}',
      'action دقیقاً یکی از این‌ها:',
      '· "add_shopping": افزودنِ مواد به لیستِ خرید — items را پر کن، هر ماده جدا، amount دقیق («۲ کیلو»،«نیم کیلو») و اگر نبود خالی.',
      '· "remove_shopping": حذفِ مواد از لیستِ خرید — items فقط با name.',
      '· "read_shopping": خواندنِ لیستِ خرید.',
      '· "add_meal": گذاشتنِ یک غذا در برنامه — day، meal (صبحانه/ناهار/شام)، dish (نامِ غذا).',
      '· "remove_meal": حذفِ یک وعده — day و meal.',
      '· "fill_week": چیدنِ کلِ برنامهٔ هفته.',
      '· "suggest": پیشنهادِ غذا — query را با ماده/نوع/مناسبت پر کن اگر گفت، وگرنه خالی.',
      '· "other": سؤال، طرزِ تهیه، جایگزینِ ماده، گپ، سلام، یا هر چیزِ نامطمئن.',
      `امروز «${dn(0)}» است؛ «فردا»=«${dn(1)}»،«پس‌فردا»=«${dn(2)}». روزها را با نامِ ${DAY.join('/')} بده و «فردا/پس‌فردا» را خودت به روزِ واقعی تبدیل کن.`,
      'نامِ مواد/غذا را کامل و دقیق بردار (مثلاً «توت فرنگی» را کامل، نه نصفه). چند ماده در یک جمله را از هم جدا کن. اگر مطمئن نیستی action="other".',
      'مثال‌ها:',
      '«۳ تا غذای محلی بگو» → {"action":"suggest","query":"محلی"}',
      '«یه خورشت خوب پیشنهاد بده» → {"action":"suggest","query":"خورشت"}',
      '«خورشت قیمه رو بزار سه‌شنبه نهار» → {"action":"add_meal","day":"سه‌شنبه","meal":"ناهار","dish":"خورشت قیمه"}',
      '«۲ کیلو موز و گوجه ۱ کیلو بذار تو لیست خرید» → {"action":"add_shopping","items":[{"name":"موز","amount":"۲ کیلو"},{"name":"گوجه","amount":"۱ کیلو"}]}',
      '«خیار رو از لیست خرید بردار» → {"action":"remove_shopping","items":[{"name":"خیار"}]}',
      '«قورمه چند کالری داره؟» → {"action":"other"}',
    ].join('\n');
    // RETRY ONCE: the free model intermittently returns malformed/empty JSON on the first shot. A second try
    // recovers most of those instead of mis-falling to the chat loop. (Same flake-tolerance as the tool loop.)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const out = await this.model.generate({ system, prompt: `پیام: «${prompt}»\nJSON:`, maxTokens: 500 }).catch(() => null);
      const parsed = this.extractJson(out?.text ?? '');
      if (parsed && typeof parsed.action === 'string') return parsed as { action: string };
    }
    return null;
  }

  /** Pull the first JSON object out of a model reply (tolerates ``` fences / surrounding prose). */
  private extractJson(text: string): { action?: string; [k: string]: unknown } | null {
    const s = String(text ?? '').replace(/```json|```/gi, '');
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]) as { action?: string }; } catch { return null; }
  }

  /** Tolerant Persian day-name → dayOfWeek (0=شنبه…6=جمعه); handles space/ZWNJ variants («سه شنبه»/«سه‌شنبه»). */
  private dayNameToNum(name: string | undefined): number | null {
    const n = String(name ?? '').replace(/[‌\s]/g, '');
    for (const [k, v] of [['یکشنبه', 1], ['دوشنبه', 2], ['سهشنبه', 3], ['چهارشنبه', 4], ['پنجشنبه', 5], ['جمعه', 6], ['شنبه', 0]] as [string, number][]) {
      if (n.includes(k)) return v;
    }
    return null;
  }

  /** DO the parsed action with deterministic, grounded code (no model decides/executes). Returns null to fall through to chat. */
  private async executeIntent(userId: string, intent: { action: string; items?: { name?: string; amount?: string }[]; day?: string; meal?: string; dish?: string; query?: string }, ctx: ToolContext): Promise<AgenticChatOutcome | null> {
    const W = (name: string) => this.writeTools.build().find((t) => t.spec.name === name);
    switch (intent.action) {
      case 'add_shopping': {
        const items = (intent.items ?? []).map((i) => ({ name: String(i?.name ?? '').trim(), amount: i?.amount ? String(i.amount).trim() : '' })).filter((i) => i.name);
        if (!items.length) return null;
        const strs = items.map((i) => (i.amount ? `${i.amount} ${i.name}` : i.name)); // add_items' splitQuantity re-parses these cleanly
        const res = (await W('add_items_to_shopping_list')?.execute({ items: strs }, ctx).catch(() => null)) as { ok?: boolean; added?: string[] } | null;
        return res?.ok ? { ok: true, text: `به لیستِ خرید اضافه کردم: ${(res.added ?? strs).join('، ')} ✅`, reason: null, toolCalls: [{ name: 'add_items_to_shopping_list', arguments: '{}' }], model: 'understand:add_shopping' } : null;
      }
      case 'remove_shopping': {
        const names = (intent.items ?? []).map((i) => String(i?.name ?? '').trim()).filter(Boolean);
        if (!names.length) return null;
        const res = (await W('remove_items_from_shopping_list')?.execute({ items: names }, ctx).catch(() => null)) as { ok?: boolean; removed?: string[] } | null;
        return res?.ok ? { ok: true, text: res.removed?.length ? `از لیستِ خرید برداشتم: ${res.removed.join('، ')} ✅` : 'چیزی با این نام تو لیستِ خریدت نبود.', reason: null, toolCalls: [{ name: 'remove_items_from_shopping_list', arguments: '{}' }], model: 'understand:remove_shopping' } : null;
      }
      case 'read_shopping': {
        const res = (await W('get_shopping_list')?.execute({}, ctx).catch(() => null)) as { ok?: boolean; items?: { name: string; amount?: string }[] } | null;
        if (!res?.ok) return null;
        const its = res.items ?? [];
        const text = its.length ? `الان تو لیستِ خریدت اینا هست:\n${its.map((i) => `- ${i.name}${i.amount ? ` (${i.amount})` : ''}`).join('\n')}` : 'لیستِ خریدت خالیه.';
        return { ok: true, text, reason: null, toolCalls: [{ name: 'get_shopping_list', arguments: '{}' }], model: 'understand:read_shopping' };
      }
      case 'add_meal': {
        const day = this.dayNameToNum(intent.day);
        const dish = String(intent.dish ?? '').trim();
        if (day === null || !intent.meal || !dish) return null;
        const recipe = await this.findOneSafeRecipe(ctx, dish);
        if (!recipe) return { ok: true, text: `«${dish}» رو تو رسپی‌هامون پیدا نکردم — اسمِ دقیق‌ترشو بگو یا یه غذای دیگه.`, reason: null, toolCalls: [], model: 'understand:add_meal' };
        const res = (await W('add_to_meal_plan')?.execute({ recipeId: recipe.id, day, mealType: intent.meal }, ctx).catch(() => null)) as { ok?: boolean } | null;
        return res?.ok ? { ok: true, text: `گذاشتم: **${recipe.title}** برای ${intent.day} ${intent.meal} ✅ — توی تبِ «برنامه» می‌بینیش.`, reason: null, toolCalls: [{ name: 'add_to_meal_plan', arguments: '{}' }], model: 'understand:add_meal' } : null;
      }
      case 'remove_meal': {
        const day = this.dayNameToNum(intent.day);
        if (day === null || !intent.meal) return null;
        const res = (await W('remove_from_meal_plan')?.execute({ day, mealType: intent.meal }, ctx).catch(() => null)) as { ok?: boolean } | null;
        return res?.ok ? { ok: true, text: `${intent.day} ${intent.meal} رو از برنامه‌ات برداشتم ✅`, reason: null, toolCalls: [{ name: 'remove_from_meal_plan', arguments: '{}' }], model: 'understand:remove_meal' } : null;
      }
      case 'fill_week': {
        const res = (await W('fill_week_plan')?.execute({}, ctx).catch(() => null)) as { ok?: boolean; week?: { day: string; meals: { meal: string; dish: string }[] }[] } | null;
        if (res?.ok && res.week?.length) {
          const text = this.formatWeekPlan(res.week);
          const verdict = await this.grounded.screenLiveOutput(userId, text, { unsafeTitles: [] } as never);
          return { ok: true, text: verdict.safe ? text : 'برنامهٔ هفته‌ات رو چیدم و ذخیره کردم ✅ — توی تبِ «برنامه» می‌بینیش.', reason: null, toolCalls: [{ name: 'fill_week_plan', arguments: '{}' }], model: 'understand:fill_week' };
        }
        return { ok: true, text: 'الان نتونستم کلِ برنامهٔ هفته رو بچینم. چند غذا رو دستی بگو می‌ذارم، یا دوباره امتحان کن.', reason: null, toolCalls: [], model: 'understand:fill_week' };
      }
      case 'suggest': {
        const dishes = await this.realDishSuggestions(ctx, String(intent.query ?? '')).catch(() => [] as { id: string; title: string }[]);
        if (dishes.length) {
          const text = this.formatSuggestions(dishes);
          const verdict = await this.grounded.screenLiveOutput(userId, text, { unsafeTitles: [] } as never);
          if (verdict.safe) return { ok: true, text, reason: null, toolCalls: [{ name: 'search_recipes', arguments: '{}' }], model: 'understand:suggest' };
        }
        return null;
      }
      default:
        return null;
    }
  }

  /** Wrap the recipe-surfacing tools with the INPUT safety filter; pass the rest through unchanged. */
  private gatedTools(userId: string, unsafeTitles: string[]): AgenticTool[] {
    return this.catalog.build().map((tool) => {
      if (tool.spec.name === 'search_recipes') return this.gateSearch(tool, userId, unsafeTitles);
      if (tool.spec.name === 'get_recipe_details') return this.gateDetails(tool, userId, unsafeTitles);
      return tool; // troubleshoot_cooking / suggest_substitutions (already allergen-aware) / get_user_context
    });
  }

  private gateSearch(tool: AgenticTool, userId: string, unsafeTitles: string[]): AgenticTool {
    return {
      spec: tool.spec,
      execute: async (args, c) => {
        const out = (await tool.execute(args, c)) as { results?: { id?: string; title?: string }[] };
        const results = Array.isArray(out?.results) ? out.results : [];
        const safe = await this.safety.filter(userId, results, 'id'); // fail-closed: authed + unloadable profile → []
        const safeIds = new Set(safe.map((r) => String(r.id)));
        for (const r of results) if (r?.id && !safeIds.has(String(r.id)) && r.title) unsafeTitles.push(String(r.title));
        return { ...out, results: safe };
      },
    };
  }

  private gateDetails(tool: AgenticTool, userId: string, unsafeTitles: string[]): AgenticTool {
    return {
      spec: tool.spec,
      execute: async (args, c) => {
        const recipeId = String(args?.recipeId ?? '').trim();
        if (recipeId) {
          const safe = await this.safety.safeIds(userId, [recipeId]); // [] when unsafe OR fail-closed
          if (!safe.length) {
            unsafeTitles.push(recipeId); // belt-and-suspenders for the output screen (it also matches allergen tokens)
            return { error: 'این رسپی با محدودیتِ غذاییِ کاربر سازگار نیست و قابلِ ارائه نیست.' };
          }
        }
        return tool.execute(args, c);
      },
    };
  }

  private systemPrompt(allergens: string[], dietLine?: string | null): string {
    const allergyLine = allergens.length
      ? `هشدارِ ایمنی: کاربر به این‌ها حساسیت/آلرژی دارد و تو هرگز نباید هیچ‌کدام را پیشنهاد دهی، در غذا بیاوری، یا در دستور ذکر کنی: ${allergens.join('، ')}.`
      : 'کاربر آلرژیِ ثبت‌شده‌ای ندارد.';
    // DATE AWARENESS (founder hit «فردا» → wrong day): give the model the real weekday anchor. JS getDay() is
    // Sun..Sat; the meal-plan week is Saturday-first (date.utils.getStartOfWeek), so dayOfWeek = (getDay()+1)%7.
    const DAY_NAMES = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const todayDow = (new Date().getDay() + 1) % 7;
    const dn = (o: number) => DAY_NAMES[(todayDow + o) % 7];
    const dateLine = `زمان: امروز «${dn(0)}» است. پس «فردا»=«${dn(1)}»، «پس‌فردا»=«${dn(2)}»، «سه روزِ بعد»=«${dn(3)}». در برنامهٔ غذایی روزِ هفته را با همین نام‌ها بده و «فردا/پس‌فردا/روزِ بعد» را خودت به روزِ واقعی تبدیل کن — هیچ‌وقت روز را حدس نزن.`;
    return [
      'تو دستیارِ آشپزیِ گارنیشی — گرم، دقیق، و فقط بر پایهٔ ابزارها.',
      dateLine,
      // BIAS TO ACTION: a screenshot showed it asking the category twice for «یه غذای مجلسی» even after the user said
      // «مهم نیست» — over-clarifying makes it feel dumb. Default to using the tools and SUGGESTING.
      'پیش‌فرض: عمل کن، نه سؤالِ پشتِ‌سرِ‌هم. برای هر درخواستِ کم‌وبیش روشن (حتی «یه غذای مجلسی و خوب») همان لحظه search_recipes را صدا بزن و ۳ گزینهٔ خوب پیشنهاد بده. حداکثر یک سؤالِ کوتاه، و فقط وقتی واقعاً بدونِ آن نمی‌شود جلو رفت. اگر کاربر گفت «مهم نیست/فرقی نمی‌کند»، دیگر نپرس — پیشنهاد بده.',
      'به گفتگوی قبلی توجه کن. اگر کاربر پیشنهادهایت را رد کرد (مثلِ «نه اینا نه»)، غذاهای **متفاوت** پیشنهاد بده و همان‌هایی که قبلاً گفتی را تکرار نکن. اگر گفت «اولی/دومی» یا «همون قبلی»، منظورش همان موردِ گفتگوی قبلی است.',
      // The model searched the literal phrase «غذای مجلسی» (an OCCASION, not a dish) → no rows → "not found".
      'یک مناسبت یا حال‌وهوا (مثلِ «مجلسی»، «مهمونی»، «سریع»، «سبک»، «مقوی») نامِ غذا نیست؛ آن کلمه را جستجو نکن چون نتیجه نمی‌دهد. به‌جایش نامِ غذاهای شناخته‌شدهٔ مناسبِ آن را جستجو کن — مثلاً برای «مجلسی»: قرمه‌سبزی، فسنجان، ته‌چین، زرشک‌پلو، باقالی‌پلو. اگر یکی نبود سراغِ بعدی برو.',
      'ابزارها: برای پیدا کردنِ غذا search_recipes؛ برای دستورِ کامل اول search_recipes بعد get_recipe_details با id؛ برای مشکلِ حینِ پخت troubleshoot_cooking؛ برای جایگزینِ ماده suggest_substitutions؛ برای محدودیت‌ها/سلیقهٔ کاربر get_user_context.',
      // brain phase B — the assistant can now DO things (reversible write-actions), not just talk.
      'کارها (فقط وقتی کاربر صریحاً خواست، و بعد کوتاه تأیید کن): «ذخیره کن»→add_favorite · «از علاقه‌مندی‌ها بردار»→remove_favorite · «فلان ماده/مواد رو به لیستِ خرید اضافه کن» (مثلِ «خیار رو اضافه کن»، «ماست و نون بذار»)→add_items_to_shopping_list · «خیار رو از لیستِ خرید بردار/حذف کن»→remove_items_from_shopping_list · «تو لیستِ خریدم چیه؟/لیستمو نشون بده»→get_shopping_list · «موادِ این غذا رو بریز تو لیستِ خرید»→add_recipe_to_shopping_list · «لیستِ خریدِ هفته رو بساز»→add_week_to_shopping_list · «فلان روز فلان وعده فلان غذا بذار»→add_to_meal_plan · «کلِ برنامهٔ هفته رو بچین/کامل کن»→fill_week_plan · «فلان روز فلان وعده رو حذف کن»→remove_from_meal_plan · «فلان ماده رو دوست ندارم/عاشقِ فلان ماده‌ام»→set_ingredient_taste (سلیقهٔ نرم، نه آلرژی). «جابه‌جا کن از روزِ X به روزِ Y» = اول remove_from_meal_plan برای X، بعد add_to_meal_plan برای Y (اگر id رسپی را نداری، اول search_recipes). همهٔ این‌ها برگشت‌پذیرند، خودت انجامشان بده و نگو «نمی‌توانم».',
      // narrate-instead-of-act: a weak model says "I'll remember that" without firing the tool. Force the call.
      'مهم: وقتی کاربر کاری خواست یا علاقه/بیزاری‌اش را گفت، **عملاً همان لحظه ابزارِ مربوط را صدا بزن** — فقط نگو «لحاظ می‌کنم/یادم می‌مونه/اضافه کردم». تا ابزار را واقعاً اجرا نکرده‌ای، نگو انجام شد. مثلاً «گردو دوست دارم» = همین حالا set_ingredient_taste با stance=like.',
      // founder hit: asked for 3 dishes across 3 days, only 2 were placed (قیمه dropped); then «قیمه چی شد؟» got a
      // description instead of a fix. Place EVERY item; treat a follow-up «X چی شد؟» as "did I add X?".
      'اگر کاربر چند غذا برای چند روز/وعده خواست، برای **هر کدام جداگانه** add_to_meal_plan را صدا بزن و **هیچ‌کدام را جا ننداز** (یک رسپی در یک خانه فقط؛ دو غذا را در یک خانه با هم قاطی نکن). اگر بعد پرسید «فلان غذا چی شد؟» یعنی احتمالاً جا انداختی — همان لحظه آن را به برنامه اضافه کن، نه اینکه فقط درباره‌اش توضیح بدهی.',
      // founder hit live: «برنامهٔ هفته رو بچین» → the model over-clarified «چند وعده؟» forever then faked an UNSAVED
      // markdown table. The WHOLE-week request has ONE tool that fills + saves everything; never stall on it.
      'برای «برنامهٔ هفته رو بچین»/«یه برنامهٔ هفتگی بساز»/«برنامهٔ این هفته رو کامل کن»/«همهٔ وعده‌ها رو بچین» **هرگز نپرس چند وعده** — همان لحظه fill_week_plan را صدا بزن (خودش همهٔ روزها و وعده‌ها را خودکار، امن و ذخیره‌شده پر می‌کند). بعد برنامه را از خروجیِ همان ابزار در یک جدولِ تمیز (روز × صبحانه/ناهار/شام) نشان بده و بپرس «لیستِ خریدش رو بسازم؟». جدولِ متنیِ من‌درآوردی نساز و بعد از چیدن، همان سؤال‌ها را تکرار نکن.',
      // FLAGSHIP WORKFLOW (the moat moment): plan → proactively offer the shopping list → one deterministic call.
      'گردشِ‌کارِ برنامهٔ هفته: بعد از اینکه چند وعده را در برنامه گذاشتی، در یک جملهٔ کوتاه پیشنهاد بده «لیستِ خریدش را هم برات بسازم؟». اگر کاربر پذیرفت (مثلِ «آره»، «بله»، «بساز»، «لطفاً»)، add_week_to_shopping_list را صدا بزن — این موادِ همهٔ غذاهای برنامهٔ هفته را یک‌جا، ادغام‌شده و به‌اندازهٔ نفرات، اضافه می‌کند؛ برای این کار تک‌تکِ رسپی‌ها را با add_recipe_to_shopping_list جدا نریز.',
      'هیچ رسپی، ماده، یا عددی از خودت نساز. مقادیر و مواد و نام‌ها را عیناً از خروجیِ ابزار بنویس — هیچ عددی را تغییر نده.',
      // NO transliteration leaps: it read «لینکشو» (= "its link") as the pasta «Linguine» and searched for it.
      'هرگز یک واژهٔ فارسی را به یک غذای خارجی ترجمه یا تبدیل نکن. واژه‌هایی مثلِ «لینک»، «لینکشو»، «صفحه‌اش»، «توی اپ ببینم» نامِ غذا نیستند — یعنی کاربر می‌خواهد همان رسپی را در صفحهٔ خودش در اپ ببیند؛ بگو رسپی در اپ روی صفحهٔ خودش هست و آن را به‌عنوانِ نامِ غذا جستجو نکن.',
      'اگر ابزارها چیزی پیدا نکردند، صادقانه بگو نداری؛ چیزی از خودت اختراع نکن.',
      ...(dietLine ? [dietLine] : []), // honor vegetarian/vegan exactly like the grounded path (regression fix)
      allergyLine,
      'کوتاه، گرم و به فارسیِ روان جواب بده.',
    ].join('\n');
  }
}
