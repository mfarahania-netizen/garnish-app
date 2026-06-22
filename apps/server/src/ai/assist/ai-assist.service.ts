import { Injectable } from '@nestjs/common';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { NutritionClaimGuardService } from '../guards/nutrition-claim.guard';
import { SuggestSubstitutionsTool } from '../tools/suggest-substitutions.tool';
import { MatchPantryRecipesTool } from '../tools/match-pantry-recipes.tool';
import { ExplainRecipeStepTool } from '../tools/explain-recipe-step.tool';
import { SuggestPairingsTool } from '../tools/suggest-pairings.tool';
import { AiTool, BehavioralContextSnapshot, MissingBehavioralContextError, ToolContext } from '../ai-core.types';

/**
 * AiAssistService (E47-L4) — the bounded, deterministic entry point for the grounded assistant tools.
 *
 * For each call it:
 *   1. builds a mandatory BehavioralContextSnapshot (Constitution E47) and FAILS FAST if invalid,
 *   2. invokes exactly one registered, read-only tool (no autonomy, no tool-chaining loop, no live LLM),
 *   3. routes the tool's natural-language output through the Nutrition-Claim Guard so substitution /
 *      pairing help can never assert a health/medical/nutrition claim (the guard is enforced + tested).
 *
 * NO live model is ever called here — these tools are pure data-grounded retrieval.
 */
@Injectable()
export class AiAssistService {
  constructor(
    private readonly snapshots: BehavioralContextSnapshotService,
    private readonly nutrition: NutritionClaimGuardService,
    private readonly substitutionsTool: SuggestSubstitutionsTool,
    private readonly pantryTool: MatchPantryRecipesTool,
    private readonly techniqueTool: ExplainRecipeStepTool,
    private readonly pairingsTool: SuggestPairingsTool,
  ) {}

  async substitutions(userId: string, input: Record<string, unknown>) {
    return this.invoke(this.substitutionsTool, userId, input);
  }
  async pantryMatch(userId: string, input: Record<string, unknown>) {
    return this.invoke(this.pantryTool, userId, input);
  }
  async technique(userId: string, input: Record<string, unknown>) {
    return this.invoke(this.techniqueTool, userId, input);
  }
  async pairings(userId: string, input: Record<string, unknown>) {
    return this.invoke(this.pairingsTool, userId, input);
  }

  /** Build the mandatory snapshot → run the tool → guard its NL output. */
  private async invoke(tool: AiTool, userId: string, input: Record<string, unknown>) {
    const snapshot = await this.snapshots.build(userId, { locale: 'fa' });
    if (!this.snapshots.validate(snapshot)) {
      throw new MissingBehavioralContextError();
    }
    const ctx: ToolContext = { userId, snapshot };
    const result = (await tool.handler(input, ctx)) as Record<string, unknown>;
    return this.applyNutritionGuard(result, snapshot);
  }

  /**
   * Inspect every natural-language string the tool produced (note + per-item reasons) with the
   * Nutrition-Claim Guard. If anything would assert an unsupported health/nutrition claim, the NL
   * `note` is replaced with safe framing and the response is flagged — the structured grounded data
   * (substitutions / matches / steps) is preserved.
   */
  private applyNutritionGuard(result: Record<string, unknown>, snapshot: BehavioralContextSnapshot) {
    const sourceLocked = snapshot.nutritionSourceLocked ?? false;
    const nlStrings: string[] = [];
    if (typeof result.note === 'string') nlStrings.push(result.note);
    for (const key of ['substitutions', 'pairings']) {
      const arr = result[key];
      if (Array.isArray(arr))
        for (const item of arr) {
          const it = item as any;
          if (it && typeof it.reason === 'string') nlStrings.push(it.reason);
          if (it && typeof it.why === 'string') nlStrings.push(it.why); // curated notesFa surfaced by the SubstitutionEngine
        }
    }
    if (typeof result.instruction === 'string') nlStrings.push(result.instruction);

    const verdict = this.nutrition.inspect(nlStrings.join('\n'), { nutritionSourceLocked: sourceLocked });
    if (verdict.blocked) {
      // neutralize per-item free text that may carry the claim (a curated `why`), preserving the structured data
      const scrubWhy = (arr: unknown) =>
        Array.isArray(arr) ? arr.map((it) => (it && typeof it === 'object' ? { ...it, why: null } : it)) : arr;
      return {
        ...result,
        substitutions: scrubWhy((result as any).substitutions),
        pairings: scrubWhy((result as any).pairings),
        note: 'این پاسخ فقط راهنمایی آشپزی است؛ ادعای تغذیه‌ای/سلامتی ارائه نمی‌شود.',
        nutritionGuard: 'blocked' as const,
        nutritionGuardReasons: verdict.reasons,
      };
    }
    return { ...result, nutritionGuard: 'pass' as const };
  }
}
