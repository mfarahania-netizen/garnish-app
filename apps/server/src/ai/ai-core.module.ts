import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AI_MODEL_PROVIDER } from './ai-core.types';
import { createModelProvider, resolveAiProviderConfig } from './providers/model-provider.factory';
import { AiOrchestratorService } from './orchestrator/ai-orchestrator.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { BehavioralContextSnapshotService } from './context/behavioral-context-snapshot.service';
import { PromptInjectionGuardService } from './guards/prompt-injection.guard';
import { AiSafetyGuardService } from './guards/ai-safety.guard';
import { NutritionClaimGuardService } from './guards/nutrition-claim.guard';
import { AiCostControllerService } from './cost/ai-cost-controller.service';
import { PersistedDailyBudgetService } from './cost/persisted-daily-budget.service';
import { SpendAlertService } from './cost/spend-alert.service';
import { GarnishRateLimitService } from './cost/garnish-rate-limit.service';
import { AiCallLogService } from './logging/ai-call-log.service';
import { ChatMessageService } from './chat/chat-message.service';
import { UserFactService } from './facts/user-fact.service';
import { SearchRecipesTool } from './tools/search-recipes.tool';
import { ExplainRecommendationTool } from './tools/explain-recommendation.tool';
import { GetUserFoodContextTool } from './tools/get-user-food-context.tool';
import { LogAiFeedbackTool } from './tools/log-ai-feedback.tool';
import { SuggestSubstitutionsTool } from './tools/suggest-substitutions.tool';
import { MatchPantryRecipesTool } from './tools/match-pantry-recipes.tool';
import { ExplainRecipeStepTool } from './tools/explain-recipe-step.tool';
import { SuggestPairingsTool } from './tools/suggest-pairings.tool';
import { AiAssistService } from './assist/ai-assist.service';
import { IntentClassifierService } from './intent/intent-classifier.service';
import { AgenticLoopService } from './agentic/agentic-loop.service';
import { AgenticToolCatalogService } from './agentic/agentic-tool-catalog.service';

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
  imports: [PrismaModule],
  providers: [
    AiOrchestratorService,
    ToolRegistryService,
    BehavioralContextSnapshotService,
    PromptInjectionGuardService,
    AiSafetyGuardService,
    NutritionClaimGuardService,
    AiCostControllerService,
    GarnishRateLimitService,
    PersistedDailyBudgetService,
    SpendAlertService,
    AiCallLogService,
    ChatMessageService,
    UserFactService,
    SearchRecipesTool,
    ExplainRecommendationTool,
    GetUserFoodContextTool,
    LogAiFeedbackTool,
    SuggestSubstitutionsTool,
    MatchPantryRecipesTool,
    ExplainRecipeStepTool,
    SuggestPairingsTool,
    AiAssistService,
    IntentClassifierService,
    AgenticLoopService,
    AgenticToolCatalogService,
    { provide: AI_MODEL_PROVIDER, useFactory: () => createModelProvider(resolveAiProviderConfig()) },
  ],
  exports: [
    AiOrchestratorService,
    ToolRegistryService,
    BehavioralContextSnapshotService,
    AiCallLogService,
    AiCostControllerService,
    GarnishRateLimitService,
    ChatMessageService,
    UserFactService,
    AiAssistService,
    IntentClassifierService,
    AgenticLoopService,
    AgenticToolCatalogService,
    AI_MODEL_PROVIDER,
  ],
})
export class AiCoreModule {}
