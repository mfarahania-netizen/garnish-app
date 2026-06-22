import { isLiveModelConfigured } from '../providers/model-provider.factory';

/**
 * AI Cost Policy (E47-A10A) — governance/safety cost-control foundation. NOT billing/monetization.
 *
 * Single source of truth for token budgets + the (currently empty) per-model rate table. There is NO
 * paid-billing or subscription logic. Cost is reported only when a real rate exists for the model;
 * otherwise `estimatedCostUsd` is null — we never invent precise cost numbers.
 */

/** Ledger schema version stamped on every AICallLog cost row (forward-migration aid). */
export const AI_COST_SCHEMA_VERSION = 1;
export const DEFAULT_CURRENCY = 'USD';

/** Default safe limits (mirrored by the in-memory AiCostControllerService). */
export const PER_REQUEST_MAX_TOKENS = 8000;
export const PER_USER_DAILY_MAX_TOKENS = 200000;

/**
 * Per-user MULTI-WINDOW token budgets + a per-user cooldown (founder requirement: 5h/daily/weekly/monthly caps +
 * a 15s gap between live calls). These bite ONLY on a LIVE provider call (the orchestrator skips them entirely on
 * the default stub path), so they are INERT until live Gemini is gated on — build-then-activate. The numbers below
 * are conservative PLACEHOLDERS to TUNE when paid credits are purchased; each is env-overridable (no redeploy).
 * Rolling windows (now − duration), not calendar buckets, so a midnight burst cannot game the cap.
 */
export interface BudgetWindow {
  /** stable id used in the block reason code, e.g. '5h' → reason 'budget_exceeded_5h'. */
  id: string;
  durationMs: number;
  /** null disables this window. */
  maxTokens: number | null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const DEFAULT_BUDGET_WINDOWS: BudgetWindow[] = [
  { id: '5h', durationMs: 5 * HOUR_MS, maxTokens: 60_000 },
  { id: 'daily', durationMs: DAY_MS, maxTokens: PER_USER_DAILY_MAX_TOKENS },
  { id: 'weekly', durationMs: 7 * DAY_MS, maxTokens: 700_000 },
  { id: 'monthly', durationMs: 30 * DAY_MS, maxTokens: 2_000_000 },
];

/** Minimum seconds between a user's LIVE provider calls (founder: "15s cooldown"). 0 disables. */
export const DEFAULT_COOLDOWN_MS = 15_000;

export type UsageSource = 'provider' | 'estimated' | 'unavailable';

export interface ModelRate {
  /** USD per 1K input tokens. */
  inputPer1k: number;
  /** USD per 1K output tokens. */
  outputPer1k: number;
}

/** Alert at 80% of the daily token budget (E47-A10C spend-alert foundation). */
export const DAILY_TOKEN_ALERT_THRESHOLD = Math.floor(PER_USER_DAILY_MAX_TOKENS * 0.8);

export interface AiCostPolicy {
  perRequestMaxTokens: number;
  perUserDailyMaxTokens: number;
  /** Per-user rolling-window token caps (INERT until a live provider call). */
  perUserBudgetWindows: BudgetWindow[];
  /** Minimum ms between a user's live provider calls (0 disables). */
  perUserCooldownMs: number;
  currency: string;
  /** Per-model USD rates. EMPTY by default → estimatedCostUsd stays null (no faked precision). */
  modelRatesUsdPer1k: Record<string, ModelRate>;
  /** Live model is allowed only when the env gate is satisfied (never on by default). */
  liveModelAllowed: boolean;
  /** Daily per-user token-usage alert threshold (null disables). */
  dailyTokenAlertThreshold: number | null;
  /** Daily per-user estimated-cost (USD) alert threshold (null disables — default, until verified rates exist). */
  dailyEstimatedCostAlertUsd: number | null;
  schemaVersion: number;
}

export const DEFAULT_AI_COST_POLICY: AiCostPolicy = {
  perRequestMaxTokens: PER_REQUEST_MAX_TOKENS,
  perUserDailyMaxTokens: PER_USER_DAILY_MAX_TOKENS,
  perUserBudgetWindows: DEFAULT_BUDGET_WINDOWS,
  perUserCooldownMs: DEFAULT_COOLDOWN_MS,
  currency: DEFAULT_CURRENCY,
  modelRatesUsdPer1k: {}, // no rates configured → no cost computed (placeholders only)
  liveModelAllowed: false,
  dailyTokenAlertThreshold: DAILY_TOKEN_ALERT_THRESHOLD,
  dailyEstimatedCostAlertUsd: null, // cost alerting inactive until verified rates exist (no faked cost)
  schemaVersion: AI_COST_SCHEMA_VERSION,
};

/** Parse a non-negative integer env var; blank/invalid → fallback. Used for budget tuning without redeploy. */
function intFromEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/**
 * Resolve the active policy; `liveModelAllowed` reflects the runtime env gate (default false). The multi-window
 * budgets + cooldown are env-overridable (AI_BUDGET_5H_MAX_TOKENS / _DAILY_ / _WEEKLY_ / _MONTHLY_, and
 * AI_BUDGET_COOLDOWN_MS) so the founder can tune them at credit-purchase WITHOUT a redeploy. An override of 0
 * disables that window/cooldown.
 */
export function resolveAiCostPolicy(env: NodeJS.ProcessEnv = process.env): AiCostPolicy {
  const overrideKey: Record<string, string> = { '5h': 'AI_BUDGET_5H_MAX_TOKENS', daily: 'AI_BUDGET_DAILY_MAX_TOKENS', weekly: 'AI_BUDGET_WEEKLY_MAX_TOKENS', monthly: 'AI_BUDGET_MONTHLY_MAX_TOKENS' };
  const perUserBudgetWindows = DEFAULT_BUDGET_WINDOWS.map((w) => {
    const key = overrideKey[w.id];
    if (!key || env[key] == null || env[key] === '') return w;
    const v = intFromEnv(env, key, w.maxTokens ?? 0);
    return { ...w, maxTokens: v === 0 ? null : v }; // explicit 0 disables the window
  });
  return {
    ...DEFAULT_AI_COST_POLICY,
    perUserBudgetWindows,
    perUserCooldownMs: intFromEnv(env, 'AI_BUDGET_COOLDOWN_MS', DEFAULT_COOLDOWN_MS),
    liveModelAllowed: isLiveModelConfigured(env),
  };
}

/**
 * Compute estimatedCostUsd from token counts IF a rate exists for the model; otherwise null.
 * Never fabricates a number when no rate is configured — R3 cost precision is explicitly deferred.
 */
export function estimateCostUsd(
  model: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  policy: AiCostPolicy = DEFAULT_AI_COST_POLICY,
): number | null {
  if (!model) return null;
  const rate = policy.modelRatesUsdPer1k[model];
  if (!rate) return null; // no rate → honest null, not a fake 0 or guess
  const inTok = Math.max(0, inputTokens ?? 0);
  const outTok = Math.max(0, outputTokens ?? 0);
  const usd = (inTok / 1000) * rate.inputPer1k + (outTok / 1000) * rate.outputPer1k;
  return Math.round(usd * 1e6) / 1e6; // 6dp
}
