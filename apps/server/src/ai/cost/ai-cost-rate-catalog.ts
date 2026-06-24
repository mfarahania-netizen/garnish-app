/**
 * AI Cost Rate Catalog (E47-A10C) - versioned, source-tagged provider/model pricing.
 *
 * GOVERNANCE ONLY - not billing, not monetization. Runtime cost is computed ONLY when a
 * verified, source-attributed production rate exists for the exact provider/model returned by
 * the ModelProvider. Missing rates still produce an honest null; rates are never guessed.
 */

export const RATE_CATALOG_SCHEMA_VERSION = 1;

export interface AiModelRate {
  /** MUST match the active provider's `ModelProvider.name` (e.g. 'gemini'). */
  provider: string;
  /** MUST match the provider-returned model id exactly. */
  model: string;
  /** USD per 1,000,000 input tokens. */
  inputRateUsdPer1M: number;
  /** USD per 1,000,000 output tokens. */
  outputRateUsdPer1M: number;
  currency: string;
  /** Human-readable source of the rate (e.g. an official pricing page name). */
  sourceName: string;
  /** URL or internal reference to the verifiable source. */
  sourceRef: string;
  /** ISO-8601 timestamp/date the rate was verified against its source. */
  verifiedAt: string;
  /** ISO-8601 start of the rate's validity window. */
  effectiveFrom: string;
  /** ISO-8601 end of validity, or null for open-ended. */
  effectiveTo: string | null;
  isActive: boolean;
  schemaVersion: number;
}

/**
 * PRODUCTION catalog - verified 2026-06-24 against the official Google AI Gemini API pricing page.
 * Active rows may be used for runtime `estimatedCostUsd`; unknown models still return null.
 */
export const PRODUCTION_RATE_CATALOG: readonly AiModelRate[] = [
  {
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    inputRateUsdPer1M: 0.25,
    outputRateUsdPer1M: 1.5,
    currency: 'USD',
    sourceName: 'Google AI for Developers - Gemini Developer API pricing (Gemini 3.1 Flash-Lite Standard Paid Tier)',
    sourceRef: 'https://ai.google.dev/gemini-api/docs/pricing',
    verifiedAt: '2026-06-24',
    effectiveFrom: '2026-06-24',
    effectiveTo: null,
    isActive: true,
    schemaVersion: RATE_CATALOG_SCHEMA_VERSION,
  },
];

/**
 * REFERENCE rates - staged, inactive rows for nearby tiers. They are not consulted by production lookup
 * until explicitly promoted into PRODUCTION_RATE_CATALOG with a fresh verifiedAt/source review.
 */
export const REFERENCE_RATES_2026: readonly AiModelRate[] = [
  {
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    inputRateUsdPer1M: 1.5,
    outputRateUsdPer1M: 9.0,
    currency: 'USD',
    sourceName: 'Google AI for Developers - Gemini Developer API pricing (Gemini 3.5 Flash Standard Paid Tier)',
    sourceRef: 'https://ai.google.dev/gemini-api/docs/pricing',
    verifiedAt: '2026-06-24',
    effectiveFrom: '2026-06-24',
    effectiveTo: null,
    isActive: false,
    schemaVersion: RATE_CATALOG_SCHEMA_VERSION,
  },
];

/** Most-recent active rate matching provider+model within the effective window at `at`, else null. */
export function getActiveRate(
  provider: string | null | undefined,
  model: string | null | undefined,
  catalog: readonly AiModelRate[] = PRODUCTION_RATE_CATALOG,
  at: Date = new Date(),
): AiModelRate | null {
  if (!provider || !model) return null;
  const t = at.getTime();
  const matches = catalog.filter(
    (r) =>
      r.isActive &&
      r.provider === provider &&
      r.model === model &&
      Date.parse(r.effectiveFrom) <= t &&
      (r.effectiveTo == null || Date.parse(r.effectiveTo) > t),
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom))[0];
}

export interface CostEstimate {
  cost: number | null;
  rateUsed: AiModelRate | null;
  currency: string | null;
}

/**
 * Estimate USD cost from token counts using a verified catalog rate.
 * - No matching rate -> cost null (honest unknown).
 * - Missing input/output split (only totalTokens) -> cost null (no faked precision).
 */
export function estimateCostUsdFromCatalog(
  provider: string | null | undefined,
  model: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  catalog: readonly AiModelRate[] = PRODUCTION_RATE_CATALOG,
  at: Date = new Date(),
): CostEstimate {
  const rate = getActiveRate(provider, model, catalog, at);
  if (!rate) return { cost: null, rateUsed: null, currency: null };
  if (inputTokens == null || outputTokens == null) {
    return { cost: null, rateUsed: rate, currency: rate.currency };
  }
  const usd =
    (Math.max(0, inputTokens) * rate.inputRateUsdPer1M + Math.max(0, outputTokens) * rate.outputRateUsdPer1M) / 1_000_000;
  return { cost: Math.round(usd * 1e6) / 1e6, rateUsed: rate, currency: rate.currency };
}