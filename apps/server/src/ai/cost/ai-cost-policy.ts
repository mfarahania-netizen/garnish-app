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
  currency: DEFAULT_CURRENCY,
  modelRatesUsdPer1k: {}, // no rates configured → no cost computed (placeholders only)
  liveModelAllowed: false,
  dailyTokenAlertThreshold: DAILY_TOKEN_ALERT_THRESHOLD,
  dailyEstimatedCostAlertUsd: null, // cost alerting inactive until verified rates exist (no faked cost)
  schemaVersion: AI_COST_SCHEMA_VERSION,
};

/** Resolve the active policy; `liveModelAllowed` reflects the runtime env gate (default false). */
export function resolveAiCostPolicy(env: NodeJS.ProcessEnv = process.env): AiCostPolicy {
  return { ...DEFAULT_AI_COST_POLICY, liveModelAllowed: isLiveModelConfigured(env) };
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
