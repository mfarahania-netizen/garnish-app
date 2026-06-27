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

    const unsafeTitles: string[] = [];
    // read-only tools pass through the allergy gate; reversible WRITE-actions (favorite, shopping-list) act only
    // on the user's own data and auto-execute (no allergy filtering needed — they're user-initiated, not recs).
    const tools = [...this.gatedTools(userId, unsafeTitles), ...this.writeTools.build()];
    const ctx: ToolContext = { userId, snapshot };

    // RETRY ONCE on a thrown loop error — the free OpenRouter tool models intermittently return an empty completion
    // (no text, no tool calls); a single retry gives the flake a second chance to actually call the tool (e.g.
    // fill_week_plan) instead of falling back to the grounded reply (which, for a plan request, fakes an unsaved table).
    let result;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await this.loop.run(this.model, {
          systemPrompt: this.systemPrompt(allergens),
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

    // 3) OUTPUT gate (fail-closed): screen the final answer; only `unsafeTitles` is read by the screen.
    const verdict = await this.grounded.screenLiveOutput(userId, result.text, { unsafeTitles } as never);
    if (!verdict.safe) {
      this.logger.warn(`agentic output BLOCKED (${verdict.reason}) — falling back to grounded reply`);
      return { ok: false, text: null, reason: `blocked:${verdict.reason}` };
    }

    return { ok: true, text: result.text, reason: null, toolCalls: result.toolCalls, model: result.model };
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

  private systemPrompt(allergens: string[]): string {
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
      'کارها (فقط وقتی کاربر صریحاً خواست، و بعد کوتاه تأیید کن): «ذخیره کن»→add_favorite · «از علاقه‌مندی‌ها بردار»→remove_favorite · «موادِ این غذا رو بریز تو لیستِ خرید»→add_recipe_to_shopping_list · «لیستِ خریدِ هفته رو بساز»→add_week_to_shopping_list · «فلان روز فلان وعده فلان غذا بذار»→add_to_meal_plan · «کلِ برنامهٔ هفته رو بچین/کامل کن»→fill_week_plan · «فلان روز فلان وعده رو حذف کن»→remove_from_meal_plan · «فلان ماده رو دوست ندارم/عاشقِ فلان ماده‌ام»→set_ingredient_taste (سلیقهٔ نرم، نه آلرژی). «جابه‌جا کن از روزِ X به روزِ Y» = اول remove_from_meal_plan برای X، بعد add_to_meal_plan برای Y (اگر id رسپی را نداری، اول search_recipes). همهٔ این‌ها برگشت‌پذیرند، خودت انجامشان بده و نگو «نمی‌توانم».',
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
      allergyLine,
      'کوتاه، گرم و به فارسیِ روان جواب بده.',
    ].join('\n');
  }
}
