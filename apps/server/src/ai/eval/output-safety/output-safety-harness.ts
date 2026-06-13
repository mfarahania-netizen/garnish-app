import { AiOrchestratorService } from '../../orchestrator/ai-orchestrator.service';
import { PromptInjectionGuardService } from '../../guards/prompt-injection.guard';
import { AiSafetyGuardService } from '../../guards/ai-safety.guard';
import { NutritionClaimGuardService } from '../../guards/nutrition-claim.guard';
import { AiCostControllerService } from '../../cost/ai-cost-controller.service';
import { AiCallLogService } from '../../logging/ai-call-log.service';
import { BehavioralContextSnapshotService } from '../../context/behavioral-context-snapshot.service';
import { createModelProvider, resolveAiProviderConfig, isLiveModelConfigured } from '../../providers/model-provider.factory';
import { ModelProvider, ModelGenerateInput, BehavioralContextSnapshot } from '../../ai-core.types';
import { OUTPUT_EVAL_CASES, OUTPUT_EVAL_SCHEMA_VERSION, OutputEvalCase } from './output-eval-cases';
import { evaluateCase, CaseEvalResult } from './output-safety-evaluator';

/**
 * E47-A11A — output safety/quality harness. Drives the REAL Orchestrator (offline stub by DEFAULT,
 * live Gemini ONLY when the env flags are set) over the eval set, then deterministically evaluates the
 * produced output. Mock Prisma → NO real DB write. No secret persisted; failure details use ids/categories.
 */

class CallCountingProvider implements ModelProvider {
  calls = 0;
  constructor(private readonly inner: ModelProvider) {}
  get name(): string {
    return this.inner.name;
  }
  async generate(input: ModelGenerateInput) {
    this.calls += 1;
    return this.inner.generate(input);
  }
}

const SNAP: BehavioralContextSnapshot = {
  userId: 'a11a-eval-user', generatedAt: '2026-06-14T00:00:00.000Z', schemaVersion: 1, locale: 'fa',
  preferences: {}, signals: {}, consents: ['core'], nutritionSourceLocked: false,
};

export interface OutputSafetyResults {
  suite: 'E47-A11A';
  schemaVersion: number;
  runMode: 'offline' | 'live';
  modelProvider: string;
  liveEnabled: boolean;
  timestamp: string;
  totalCases: number;
  passed: number;
  failed: number;
  blockedBeforeProvider: number;
  /** LIVE provider calls only — always 0 in offline mode. */
  providerCalls: number;
  /** model.generate invocations incl. the offline stub (transparency; offline = stub, no network). */
  modelInvocations: number;
  categories: Record<string, { total: number; passed: number; failed: number }>;
  failureDetails: { id: string; category: string; severity: string; failReasons: string[] }[];
  cases: CaseEvalResult[];
}

export async function runOutputSafetyEval(
  env: NodeJS.ProcessEnv = process.env,
  // opts.provider lets a deterministic ADVERSARIAL FIXTURE provider be injected (offline, no network) so
  // the harness can actually exercise the output detectors against unsafe model text — see the spec.
  opts: { cases?: readonly OutputEvalCase[]; timestamp?: string; provider?: ModelProvider } = {},
): Promise<OutputSafetyResults> {
  const cfg = resolveAiProviderConfig(env);
  const live = isLiveModelConfigured(env);
  const cases = opts.cases ?? OUTPUT_EVAL_CASES;

  // mock Prisma — no real DB write; AICallLog still exercised through its real service.
  const prisma: any = {
    aICallLog: { create: async ({ data }: any) => ({ id: 'log', ...data }) },
    userPreference: { findUnique: async () => null },
  };
  const provider = new CallCountingProvider(opts.provider ?? createModelProvider(cfg));
  const orch = new AiOrchestratorService(
    provider,
    new PromptInjectionGuardService(),
    new AiCostControllerService(),
    new AiSafetyGuardService(),
    new NutritionClaimGuardService(),
    new AiCallLogService(prisma),
    new BehavioralContextSnapshotService(prisma),
    // budget/alert services intentionally omitted — eval focuses on OUTPUT safety; budget is proven in A10B.
  );

  const results: CaseEvalResult[] = [];
  let modelInvocations = 0;
  let blockedBeforeProvider = 0;

  for (const c of cases) {
    const before = provider.calls;
    let status = 'error';
    let output: string | null = null;
    try {
      const r = await orch.run({ userId: SNAP.userId, prompt: c.input, snapshot: SNAP, surface: 'eval' });
      status = r.status;
      output = r.text;
    } catch {
      status = 'error';
    }
    const providerCalled = provider.calls > before;
    if (providerCalled) modelInvocations += 1;
    else blockedBeforeProvider += 1;
    results.push(evaluateCase(c, { status, providerCalled, output }));
  }
  // LIVE calls only — offline uses the stub (no network), so providerCalls stays 0 offline.
  const providerCalls = live ? modelInvocations : 0;

  const categories: OutputSafetyResults['categories'] = {};
  for (const r of results) {
    const k = r.category;
    categories[k] = categories[k] ?? { total: 0, passed: 0, failed: 0 };
    categories[k].total += 1;
    categories[k][r.pass ? 'passed' : 'failed'] += 1;
  }
  const failed = results.filter((r) => !r.pass);

  return {
    suite: 'E47-A11A',
    schemaVersion: OUTPUT_EVAL_SCHEMA_VERSION,
    runMode: live ? 'live' : 'offline',
    modelProvider: cfg.provider,
    liveEnabled: live,
    timestamp: opts.timestamp ?? new Date().toISOString(),
    totalCases: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    blockedBeforeProvider,
    providerCalls,
    modelInvocations,
    categories,
    // NO raw prompt text — ids/categories/reasons only.
    failureDetails: failed.map((f) => ({ id: f.id, category: f.category, severity: f.severity, failReasons: f.failReasons })),
    cases: results,
  };
}
