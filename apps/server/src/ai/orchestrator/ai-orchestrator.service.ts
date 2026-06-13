import { Inject, Injectable } from '@nestjs/common';
import {
  AI_MODEL_PROVIDER,
  AiCallRequest,
  AiCallResult,
  AiCallStatus,
  ModelProvider,
  MissingBehavioralContextError,
} from '../ai-core.types';
import { PromptInjectionGuardService } from '../guards/prompt-injection.guard';
import { AiSafetyGuardService } from '../guards/ai-safety.guard';
import { NutritionClaimGuardService } from '../guards/nutrition-claim.guard';
import { AiCostControllerService } from '../cost/ai-cost-controller.service';
import { AiCallLogService } from '../logging/ai-call-log.service';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';

/**
 * AI Orchestrator (E47-A1) — the SINGLE entry point for all AI calls.
 *
 * Pipeline (deterministic, no autonomy, no multi-agent):
 *   1. require a valid BehavioralContextSnapshot — else fail fast (throw).
 *   2. Prompt Injection Guard (inbound) → block.
 *   3. Cost Controller (per-call / per-user budget) → block.
 *   4. Safety Guard (inbound) → block medical/strict-diet/allergy-unsafe/fake-vision.
 *   5. Model call via the pluggable ModelProvider (stub in tests; no live LLM required).
 *   6. Nutrition Claim Guard (outbound) → block unsupported health/nutrition claims.
 *   7. Record the call via AiCallLogService (always — incl. blocked/error paths).
 *
 * Every terminal path logs exactly one AICall record.
 */
@Injectable()
export class AiOrchestratorService {
  constructor(
    @Inject(AI_MODEL_PROVIDER) private readonly model: ModelProvider,
    private readonly promptInjection: PromptInjectionGuardService,
    private readonly cost: AiCostControllerService,
    private readonly safety: AiSafetyGuardService,
    private readonly nutrition: NutritionClaimGuardService,
    private readonly callLog: AiCallLogService,
    private readonly snapshots: BehavioralContextSnapshotService,
  ) {}

  async run(request: AiCallRequest): Promise<AiCallResult> {
    const start = Date.now();
    const guardHits: string[] = [];
    const toolCalls: string[] = [];

    // 1. mandatory snapshot — fail fast (no model call, no log of a "successful" call)
    if (!this.snapshots.validate(request.snapshot)) {
      throw new MissingBehavioralContextError();
    }
    const snapshot = request.snapshot!;

    // 2. prompt injection (inbound)
    const injection = this.promptInjection.inspect(request.prompt);
    if (injection.blocked) {
      guardHits.push('prompt_injection');
      return this.finish({ request, status: 'blocked_injection', guardHits, toolCalls, reasons: injection.reasons, start });
    }

    // 3. cost
    const costCheck = this.cost.check({ userId: request.userId, estimatedTokens: request.estimatedTokens });
    if (!costCheck.allowed) {
      guardHits.push('cost_limit');
      return this.finish({ request, status: 'blocked_cost', guardHits, toolCalls, reasons: [costCheck.reason ?? 'cost limit'], start });
    }

    // 4. safety (inbound)
    const safety = this.safety.inspect(request.prompt);
    if (safety.blocked) {
      guardHits.push('safety');
      return this.finish({ request, status: 'blocked_safety', guardHits, toolCalls, reasons: safety.reasons, start });
    }

    // 5. model call (stubbed provider in tests; never a live LLM in CI)
    let text: string;
    let model: string;
    let inputTokens: number | null;
    let outputTokens: number | null;
    try {
      const result = await this.model.generate({ prompt: request.prompt });
      text = result.text;
      model = result.model;
      inputTokens = result.usage?.promptTokens ?? request.estimatedTokens ?? null;
      outputTokens = result.usage?.completionTokens ?? null;
    } catch (err) {
      return this.finish({
        request,
        status: 'error',
        guardHits,
        toolCalls,
        reasons: ['model_error'],
        start,
        errorCode: 'model_error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }

    // 6. nutrition claim guard (outbound)
    const sourceLocked = request.nutritionSourceLocked ?? snapshot.nutritionSourceLocked ?? false;
    const nut = this.nutrition.inspect(text, { nutritionSourceLocked: sourceLocked });
    if (nut.blocked) {
      guardHits.push('nutrition_claim');
      return this.finish({ request, status: 'blocked_nutrition', model, inputTokens, outputTokens, guardHits, toolCalls, reasons: nut.reasons, start });
    }

    // success — record actual usage
    this.cost.record({ userId: request.userId, tokens: (inputTokens ?? 0) + (outputTokens ?? 0) });
    return this.finish({ request, status: 'ok', text, model, inputTokens, outputTokens, guardHits, toolCalls, reasons: [], start });
  }

  private async finish(args: {
    request: AiCallRequest;
    status: AiCallStatus;
    text?: string | null;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    guardHits: string[];
    toolCalls: string[];
    reasons: string[];
    start: number;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<AiCallResult> {
    const latencyMs = Date.now() - args.start;
    // persist an audit row for EVERY terminal path (success or blocked); never throws.
    await this.callLog.record({
      userId: args.request.userId,
      eventId: null,
      conversationId: args.request.conversationId ?? null,
      surface: args.request.surface ?? null,
      model: args.model ?? null,
      provider: this.model.name,
      status: args.status,
      latencyMs,
      estimatedInputTokens: args.inputTokens ?? null,
      estimatedOutputTokens: args.outputTokens ?? null,
      estimatedCost: null, // no billing logic yet
      guardHits: args.guardHits,
      toolCalls: args.toolCalls,
      metadata: args.reasons.length ? { reasons: args.reasons } : {},
      errorCode: args.errorCode ?? null,
      errorMessage: args.errorMessage ?? null,
    });
    return {
      status: args.status,
      text: args.text ?? null,
      model: args.model ?? null,
      blocked: args.status !== 'ok' && args.status !== 'error',
      guardHits: args.guardHits,
      toolCalls: args.toolCalls,
      reasons: args.reasons,
    };
  }
}
