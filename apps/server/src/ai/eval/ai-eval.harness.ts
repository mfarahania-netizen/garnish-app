import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { PromptInjectionGuardService } from '../guards/prompt-injection.guard';
import { AiSafetyGuardService } from '../guards/ai-safety.guard';
import { NutritionClaimGuardService } from '../guards/nutrition-claim.guard';
import { AiCostControllerService } from '../cost/ai-cost-controller.service';
import { AiCallLogService } from '../logging/ai-call-log.service';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { SearchRecipesTool } from '../tools/search-recipes.tool';
import { ExplainRecommendationTool } from '../tools/explain-recommendation.tool';
import { GetUserFoodContextTool } from '../tools/get-user-food-context.tool';
import { LogAiFeedbackTool } from '../tools/log-ai-feedback.tool';
import { SuggestSubstitutionsTool } from '../tools/suggest-substitutions.tool';
import { MatchPantryRecipesTool } from '../tools/match-pantry-recipes.tool';
import { ExplainRecipeStepTool } from '../tools/explain-recipe-step.tool';
import { SuggestPairingsTool } from '../tools/suggest-pairings.tool';
import { AiAssistService } from '../assist/ai-assist.service';
import { UserFactService, SensitiveFactRejectedError } from '../facts/user-fact.service';
import { resolveAiProviderConfig } from '../providers/model-provider.factory';
import { ModelProvider, BehavioralContextSnapshot } from '../ai-core.types';
import { EVAL_CASES, COVERAGE_GAPS, RESOLVED_GAPS, EvalCase } from './eval-cases';

/** In-memory counting provider — NEVER a live LLM (proves no external API in eval). */
class CountingProvider implements ModelProvider {
  calls = 0;
  constructor(
    readonly name: string,
    private readonly text: string,
  ) {}
  async generate() {
    this.calls += 1;
    return {
      text: this.text,
      model: this.name === 'gemini' ? 'gemini-2.5-flash' : 'stub-model-v0',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    };
  }
}

function capturingPrisma(recipes: any[] = []) {
  const aiRows: any[] = [];
  const prisma: any = {
    aICallLog: {
      create: async ({ data }: any) => {
        aiRows.push(data);
        return { id: `log_${aiRows.length}` };
      },
    },
    recipe: { findMany: async () => recipes },
    recommendationExposure: { findFirst: async () => null },
    userPreference: { findUnique: async () => null },
    userFact: { upsert: async ({ create }: any) => ({ id: 'f1', ...create }), findUnique: async () => null, findMany: async () => [] },
  };
  return { prisma, aiRows };
}

const SNAP: BehavioralContextSnapshot = {
  userId: 'eval-user',
  generatedAt: '2026-06-13T00:00:00.000Z',
  schemaVersion: 1,
  locale: 'fa',
  preferences: {},
  signals: {},
  consents: ['core'],
  nutritionSourceLocked: false,
};

export interface EvalCaseResult {
  id: string;
  category: string;
  description: string;
  kind: string;
  passed: boolean;
  failures: string[];
  actual: Record<string, unknown>;
}

export interface EvalRunResult {
  suite: 'E47-A6';
  total: number;
  passed: number;
  failed: number;
  liveApiCalled: false;
  minimums: { total: number; promptInjection: number; medicalNutrition: number; fakeVision: number; logging: number };
  byCategory: Record<string, { total: number; passed: number }>;
  cases: EvalCaseResult[];
  coverageGaps: typeof COVERAGE_GAPS;
  resolvedGaps: typeof RESOLVED_GAPS;
}

async function runChat(c: EvalCase) {
  const { prisma, aiRows } = capturingPrisma();
  const provider = new CountingProvider('stub-eval', c.providerText ?? '[stub]');
  const cost = new AiCostControllerService();
  if (c.costPerCallLimit != null) cost.configure({ perCallTokenLimit: c.costPerCallLimit });
  const orch = new AiOrchestratorService(
    provider,
    new PromptInjectionGuardService(),
    cost,
    new AiSafetyGuardService(),
    new NutritionClaimGuardService(),
    new AiCallLogService(prisma),
    new BehavioralContextSnapshotService(prisma),
  );
  const snapshot = c.noSnapshot ? undefined : { ...SNAP, nutritionSourceLocked: c.nutritionSourceLocked ?? false };
  let status: string | undefined;
  let guardHits: string[] = [];
  let threw = false;
  try {
    const res = await orch.run({ userId: 'eval-user', prompt: c.prompt ?? '', snapshot, surface: 'chat', estimatedTokens: c.estimatedTokens });
    status = res.status;
    guardHits = res.guardHits;
  } catch {
    threw = true;
  }
  const row = aiRows[0];
  return {
    status,
    threw,
    providerCalled: provider.calls > 0,
    guardHits,
    logged: aiRows.length > 0,
    logRowValid: row
      ? 'provider' in row && 'status' in row && typeof row.latencyMs === 'number' && Array.isArray(row.guardHits) && Array.isArray(row.toolCalls)
      : false,
  };
}

/** Prisma mock for the L4 grounded tools, driven by per-case fixtures (faithful to the real queries). */
function groundingPrisma(c: EvalCase): any {
  const ingredients = c.fixtureIngredients ?? [];
  const recipes = c.fixtureRecipes ?? [];
  const recipe = c.fixtureRecipe ?? null;
  return {
    ingredient: {
      findMany: async (args: any) => {
        if (args?.where?.category !== undefined) {
          const notId = args?.where?.NOT?.id;
          return ingredients.filter((i: any) => i.category === args.where.category && i.id !== notId);
        }
        const ors = args?.where?.OR ?? [];
        const needle = ors[0]?.nameFa?.contains;
        if (!needle) return [];
        const hit = ingredients.find((i: any) => [i.nameFa, i.nameEn, i.code].some((v: any) => v && String(v).includes(String(needle))));
        return hit ? [hit] : [];
      },
    },
    recipe: {
      findMany: async () => recipes,
      findUnique: async (args: any) => (recipe && recipe.id === args?.where?.id ? recipe : null),
    },
    aICallLog: { create: async () => ({ id: 'l' }) },
  };
}

/** Shared grounding assertions: result status + SURFACED name inclusion/exclusion (no fabrication). */
function checkToolGrounding(out: any, e: EvalCase['expect'], actual: Record<string, unknown>, failures: string[]) {
  actual.resultStatus = out.resultStatus;
  // Only the names actually SURFACED to the user (not diagnostic fields like `dropped`).
  const surfaced: string[] = [];
  for (const k of ['substitutions', 'pairings']) {
    if (Array.isArray(out[k])) for (const it of out[k]) if (it?.name) surfaced.push(String(it.name));
  }
  if (Array.isArray(out.matches)) for (const m of out.matches) if (m?.title) surfaced.push(String(m.title));
  const surfacedStr = surfaced.join('\n');
  actual.surfaced = surfaced;
  if (e.toolResultStatus && out.resultStatus !== e.toolResultStatus) failures.push(`resultStatus: expected ${e.toolResultStatus}, got ${out.resultStatus}`);
  for (const n of e.includesNames ?? []) if (!surfacedStr.includes(n)) failures.push(`expected surfaced output to include "${n}" (got ${JSON.stringify(surfaced)})`);
  for (const n of e.excludesNames ?? []) if (surfacedStr.includes(n)) failures.push(`expected surfaced output to EXCLUDE "${n}"`);
}

async function runCase(c: EvalCase): Promise<EvalCaseResult> {
  const failures: string[] = [];
  const actual: Record<string, unknown> = {};
  const e = c.expect;

  if (c.kind === 'chat' || c.kind === 'snapshot') {
    const r = await runChat(c);
    Object.assign(actual, r);
    if (e.throws !== undefined && r.threw !== e.throws) failures.push(`throws: expected ${e.throws}, got ${r.threw}`);
    if (e.status !== undefined && r.status !== e.status) failures.push(`status: expected ${e.status}, got ${r.status}`);
    if (e.providerCalled !== undefined && r.providerCalled !== e.providerCalled) failures.push(`providerCalled: expected ${e.providerCalled}, got ${r.providerCalled}`);
    if (e.guardHitsInclude) for (const g of e.guardHitsInclude) if (!r.guardHits.includes(g)) failures.push(`guardHits missing "${g}" (got ${JSON.stringify(r.guardHits)})`);
    if (e.logged !== undefined && r.logged !== e.logged) failures.push(`logged: expected ${e.logged}, got ${r.logged}`);
    if (e.logged === true && !r.logRowValid) failures.push('logged row missing required fields (provider/status/latencyMs/guardHits/toolCalls)');
  } else if (c.kind === 'tool_search') {
    const { prisma } = capturingPrisma(c.recipes ?? []);
    const out: any = await new SearchRecipesTool(prisma).handler({ query: c.query }, { userId: 'eval-user', snapshot: SNAP });
    actual.resultStatus = out.resultStatus;
    actual.resultsLength = out.results.length;
    if (e.toolResultStatus && out.resultStatus !== e.toolResultStatus) failures.push(`resultStatus: expected ${e.toolResultStatus}, got ${out.resultStatus}`);
    if (e.nonEmptyResults && out.results.length === 0) failures.push('expected non-empty results');
    if (e.emptyResults && out.results.length !== 0) failures.push('expected empty results (no invented recipes)');
  } else if (c.kind === 'tool_context') {
    const out: any = await new GetUserFoodContextTool().handler({}, { userId: 'eval-user', snapshot: { ...SNAP, preferences: c.snapshotPreferences } });
    actual.preferences = out.preferences;
    for (const k of e.excludesKeys ?? []) if (Object.prototype.hasOwnProperty.call(out.preferences, k)) failures.push(`sensitive key not excluded: ${k}`);
  } else if (c.kind === 'tool_fact') {
    const { prisma } = capturingPrisma();
    let rejected = false;
    try {
      await new UserFactService(prisma).upsert({ userId: 'eval-user', key: c.factKey ?? '', value: true, source: 'eval' });
    } catch (err) {
      rejected = err instanceof SensitiveFactRejectedError;
    }
    actual.rejected = rejected;
    if (e.rejected !== undefined && rejected !== e.rejected) failures.push(`rejected: expected ${e.rejected}, got ${rejected}`);
  } else if (c.kind === 'tool_feedback') {
    const { prisma, aiRows } = capturingPrisma();
    const out: any = await new LogAiFeedbackTool(new AiCallLogService(prisma)).handler({ ...c.feedback }, { userId: 'eval-user', snapshot: SNAP });
    const metaStr = JSON.stringify(aiRows[0]?.metadata ?? {});
    const piiFree = !/@/.test(metaStr) && !/\d{8,}/.test(metaStr);
    actual.feedbackLogged = out.logged;
    actual.metadata = aiRows[0]?.metadata;
    actual.metadataPiiFree = piiFree;
    if (e.feedbackLogged !== undefined && out.logged !== e.feedbackLogged) failures.push(`feedbackLogged: expected ${e.feedbackLogged}, got ${out.logged}`);
    if (e.metadataPiiFree && !piiFree) failures.push(`metadata not PII-free: ${metaStr}`);
  } else if (c.kind === 'registry') {
    const { prisma } = capturingPrisma();
    const registry = new ToolRegistryService(
      new SearchRecipesTool(prisma),
      new ExplainRecommendationTool(prisma),
      new GetUserFoodContextTool(),
      new LogAiFeedbackTool(new AiCallLogService(prisma)),
      new SuggestSubstitutionsTool(prisma),
      new MatchPantryRecipesTool(prisma),
      new ExplainRecipeStepTool(prisma),
      new SuggestPairingsTool(prisma),
    );
    const names = registry.list().sort();
    actual.toolNames = names;
    if (e.toolNames && JSON.stringify(names) !== JSON.stringify([...e.toolNames].sort())) failures.push(`toolNames: expected ${JSON.stringify(e.toolNames)}, got ${JSON.stringify(names)}`);
  } else if (c.kind === 'config') {
    const cfg = resolveAiProviderConfig((c.env ?? {}) as any);
    // selection logic mirrors createModelProvider WITHOUT constructing the SDK provider
    const selected = cfg.provider === 'gemini' && cfg.liveEnabled && cfg.apiKey ? 'gemini' : 'stub';
    actual.configProvider = selected;
    if (e.configProvider && selected !== e.configProvider) failures.push(`configProvider: expected ${e.configProvider}, got ${selected}`);
  } else if (c.kind === 'tool_substitution') {
    const out: any = await new SuggestSubstitutionsTool(groundingPrisma(c)).handler(c.toolInput ?? {}, { userId: 'eval-user', snapshot: SNAP });
    checkToolGrounding(out, e, actual, failures);
  } else if (c.kind === 'tool_pantry') {
    const out: any = await new MatchPantryRecipesTool(groundingPrisma(c)).handler(c.toolInput ?? {}, { userId: 'eval-user', snapshot: SNAP });
    checkToolGrounding(out, e, actual, failures);
  } else if (c.kind === 'tool_technique') {
    const out: any = await new ExplainRecipeStepTool(groundingPrisma(c)).handler(c.toolInput ?? {}, { userId: 'eval-user', snapshot: SNAP });
    checkToolGrounding(out, e, actual, failures);
  } else if (c.kind === 'tool_pairing') {
    const out: any = await new SuggestPairingsTool(groundingPrisma(c)).handler(c.toolInput ?? {}, { userId: 'eval-user', snapshot: SNAP });
    checkToolGrounding(out, e, actual, failures);
  } else if (c.kind === 'assist_guard') {
    const snapshots: any = { build: async () => SNAP, validate: () => true };
    const fakeTool = { name: 'suggest_substitutions', description: 'eval', handler: async () => ({ resultStatus: 'ok', substitutions: [{ name: 'سیر', reason: 'eval' }], note: c.assistNote ?? '' }) };
    const svc = new AiAssistService(snapshots, new NutritionClaimGuardService(), fakeTool as any, fakeTool as any, fakeTool as any, fakeTool as any);
    const out: any = await svc.substitutions('eval-user', {});
    actual.nutritionGuard = out.nutritionGuard;
    actual.substitutionsPreserved = Array.isArray(out.substitutions) && out.substitutions.length > 0;
    const blocked = out.nutritionGuard === 'blocked';
    if (e.nutritionGuardBlocked !== undefined && blocked !== e.nutritionGuardBlocked) failures.push(`nutritionGuardBlocked: expected ${e.nutritionGuardBlocked}, got ${blocked}`);
  }

  return { id: c.id, category: c.category, description: c.description, kind: c.kind, passed: failures.length === 0, failures, actual };
}

export async function runEvalSuite(): Promise<EvalRunResult> {
  const cases: EvalCaseResult[] = [];
  for (const c of EVAL_CASES) cases.push(await runCase(c));

  const byCategory: Record<string, { total: number; passed: number }> = {};
  for (const r of cases) {
    byCategory[r.category] ??= { total: 0, passed: 0 };
    byCategory[r.category].total += 1;
    if (r.passed) byCategory[r.category].passed += 1;
  }
  const count = (cat: string) => cases.filter((c) => c.category === cat).length;

  return {
    suite: 'E47-A6',
    total: cases.length,
    passed: cases.filter((c) => c.passed).length,
    failed: cases.filter((c) => !c.passed).length,
    liveApiCalled: false,
    minimums: {
      total: cases.length,
      promptInjection: count('prompt_injection'),
      medicalNutrition: count('medical_refusal') + count('nutrition_claims'),
      fakeVision: count('fake_vision'),
      logging: count('cost_latency_logging'),
    },
    byCategory,
    cases,
    coverageGaps: COVERAGE_GAPS,
    resolvedGaps: RESOLVED_GAPS,
  };
}
