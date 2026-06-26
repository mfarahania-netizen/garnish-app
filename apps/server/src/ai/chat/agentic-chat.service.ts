import { Injectable, Logger, Inject } from '@nestjs/common';
import { AI_MODEL_PROVIDER, ModelProvider, ToolContext, BehavioralContextSnapshot } from '../ai-core.types';
import { AgenticLoopService, AgenticTool } from '../agentic/agentic-loop.service';
import { AgenticToolCatalogService } from '../agentic/agentic-tool-catalog.service';
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
    private readonly grounded: GroundedReplyService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  /** The agentic brain is usable only when the flag is on AND the active model can call tools. */
  isEnabled(): boolean {
    return String(process.env[FLAG] ?? '').toLowerCase() === 'true' && typeof this.model.generateWithTools === 'function';
  }

  async reply(userId: string, prompt: string, snapshot: BehavioralContextSnapshot): Promise<AgenticChatOutcome> {
    if (!this.isEnabled()) return { ok: false, text: null, reason: 'disabled' };

    // 1) PRE gate (fail-closed): we must establish the reconciled allergy set before running the model.
    const allergens = await this.grounded.getDeclaredAllergens(userId);
    if (allergens === null) {
      this.logger.warn(`agentic declined: allergy set unavailable for ${userId} (fail-closed)`);
      return { ok: false, text: null, reason: 'allergy_unavailable' };
    }

    const unsafeTitles: string[] = [];
    const tools = this.gatedTools(userId, unsafeTitles);
    const ctx: ToolContext = { userId, snapshot };

    let result;
    try {
      result = await this.loop.run(this.model, {
        systemPrompt: this.systemPrompt(allergens),
        userPrompt: prompt,
        tools,
        ctx,
        maxIterations: 5,
      });
    } catch (e) {
      this.logger.warn(`agentic loop failed: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, text: null, reason: 'error' };
    }

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
    return [
      'تو دستیارِ آشپزیِ گارنیشی — گرم، دقیق، و فقط بر پایهٔ ابزارها.',
      'ابزارها را هوشمندانه به‌کار ببر: برای پیدا کردنِ غذا search_recipes؛ برای دستورِ کامل اول search_recipes بعد get_recipe_details با id؛ برای مشکلِ حینِ پخت troubleshoot_cooking؛ برای جایگزینِ ماده suggest_substitutions؛ برای محدودیت‌ها/سلیقهٔ کاربر get_user_context.',
      'هیچ رسپی، ماده، یا عددی از خودت نساز. مقادیر و مواد و نام‌ها را عیناً از خروجیِ ابزار بنویس — هیچ عددی را تغییر نده.',
      'اگر ابزارها چیزی پیدا نکردند، صادقانه بگو نداری؛ چیزی از خودت اختراع نکن.',
      allergyLine,
      'کوتاه، گرم و به فارسیِ روان جواب بده.',
    ].join('\n');
  }
}
