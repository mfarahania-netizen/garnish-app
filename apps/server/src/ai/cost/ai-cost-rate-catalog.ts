/**
 * AI Cost Rate Catalog (E47-A10C) — versioned, source-tagged provider/model pricing.
 *
 * GOVERNANCE ONLY — not billing, not monetization. Lets the system produce an HONEST estimated cost
 * ONLY when a verified, source-attributed rate exists. We do NOT invent prices: the production catalog
 * ships EMPTY (no active rates) because no verified rate source is available in this task context, so
 * `estimatedCostUsd` stays null at runtime and R3 stays Mitigating. Tests inject clearly test-only rates.
 */

export const RATE_CATALOG_SCHEMA_VERSION = 1;

export interface AiModelRate {
  /** MUST match the active provider's `ModelProvider.name` (e.g. 'gemini') — that is the key getActiveRate
   *  is queried with at runtime (orchestrator passes `this.model.name`). Keep these aligned when adding rates. */
  provider: string;
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
  /** ISO-8601 timestamp the rate was verified against its source. */
  verifiedAt: string;
  /** ISO-8601 start of the rate's validity window. */
  effectiveFrom: string;
  /** ISO-8601 end of validity, or null for open-ended. */
  effectiveTo: string | null;
  isActive: boolean;
  schemaVersion: number;
}

/**
 * PRODUCTION catalog — intentionally EMPTY (no verified rates available). Do NOT add unverified prices
 * here as production truth; any real entry MUST carry provider/model/rates/currency/source/verifiedAt/
 * effectiveFrom/isActive/schemaVersion. Until then, runtime estimatedCostUsd remains null.
 */
export const PRODUCTION_RATE_CATALOG: readonly AiModelRate[] = [];

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
 * - No matching rate → cost null (honest unknown).
 * - Missing input/output split (only totalTokens) → cost null (no faked precision).
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
    // we have a rate but not the input/output split → refuse to fake precision
    return { cost: null, rateUsed: rate, currency: rate.currency };
  }
  const usd =
    (Math.max(0, inputTokens) * rate.inputRateUsdPer1M + Math.max(0, outputTokens) * rate.outputRateUsdPer1M) / 1_000_000;
  return { cost: Math.round(usd * 1e6) / 1e6, rateUsed: rate, currency: rate.currency };
}
