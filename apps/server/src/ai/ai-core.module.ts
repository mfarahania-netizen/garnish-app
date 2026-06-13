import { Module } from '@nestjs/common';
import { AI_MODEL_PROVIDER } from './ai-core.types';
import { StubModelProvider } from './model/stub-model-provider';
import { AiOrchestratorService } from './orchestrator/ai-orchestrator.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { BehavioralContextSnapshotService } from './context/behavioral-context-snapshot.service';
import { PromptInjectionGuardService } from './guards/prompt-injection.guard';
import { AiSafetyGuardService } from './guards/ai-safety.guard';
import { NutritionClaimGuardService } from './guards/nutrition-claim.guard';
import { AiCostControllerService } from './cost/ai-cost-controller.service';
import { AiCallLogService } from './logging/ai-call-log.service';

/**
 * AI Core v1 skeleton (E47-A1).
 *
 * Single Orchestrator + Tool Registry + mandatory BehavioralContextSnapshot + AICallLog + Cost
 * Controller + Safety/Nutrition/PromptInjection guards. Model provider is the deterministic stub by
 * default (no live LLM); a real Gemini provider is swapped via the AI_MODEL_PROVIDER token in A2.
 *
 * NOT included (by design): autonomous agents, multi-agent/LangGraph, vision, medical advice,
 * irreversible actions, DB persistence (ChatMessage/UserFact/AICallLog migration pending approval).
 * Coexists with the legacy AiModule; routing legacy calls through the orchestrator is E47-A2.
 */
@Module({
  providers: [
    AiOrchestratorService,
    ToolRegistryService,
    BehavioralContextSnapshotService,
    PromptInjectionGuardService,
    AiSafetyGuardService,
    NutritionClaimGuardService,
    AiCostControllerService,
    AiCallLogService,
    { provide: AI_MODEL_PROVIDER, useClass: StubModelProvider },
  ],
  exports: [
    AiOrchestratorService,
    ToolRegistryService,
    BehavioralContextSnapshotService,
    AiCallLogService,
    AiCostControllerService,
  ],
})
export class AiCoreModule {}
