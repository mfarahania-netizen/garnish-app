import {
  PRODUCTION_RATE_CATALOG,
  REFERENCE_RATES_2026,
  getActiveRate,
  estimateCostUsdFromCatalog,
  AiModelRate,
  RATE_CATALOG_SCHEMA_VERSION,
} from './ai-cost-rate-catalog';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

/** TEST-ONLY fixture rate - clearly NOT production truth (no verified source). */
const TEST_RATE: AiModelRate = {
  provider: 'gemini',
  model: DEFAULT_MODEL,
  inputRateUsdPer1M: 0.3,
  outputRateUsdPer1M: 2.5,
  currency: 'USD',
  sourceName: 'TEST-ONLY fixture (not production truth)',
  sourceRef: 'test://fixture',
  verifiedAt: '2026-06-14T00:00:00.000Z',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  isActive: true,
  schemaVersion: RATE_CATALOG_SCHEMA_VERSION,
};

describe('AI cost rate catalog (E47-A10C)', () => {
  it('production catalog contains a verified active rate for the default live model', () => {
    expect(PRODUCTION_RATE_CATALOG.length).toBeGreaterThan(0);
    const rate = getActiveRate('gemini', DEFAULT_MODEL, PRODUCTION_RATE_CATALOG, new Date('2026-06-24T12:00:00.000Z'));
    expect(rate).toMatchObject({
      provider: 'gemini',
      model: DEFAULT_MODEL,
      inputRateUsdPer1M: 0.25,
      outputRateUsdPer1M: 1.5,
      currency: 'USD',
      isActive: true,
      schemaVersion: RATE_CATALOG_SCHEMA_VERSION,
    });
    expect(rate?.sourceRef).toBe('https://ai.google.dev/gemini-api/docs/pricing');
    expect(rate?.verifiedAt).toBe('2026-06-24');
  });

  it('production estimate resolves for the default live model (no silent null)', () => {
    const e = estimateCostUsdFromCatalog('gemini', DEFAULT_MODEL, 1_000_000, 1_000_000, PRODUCTION_RATE_CATALOG, new Date('2026-06-24T12:00:00.000Z'));
    expect(e.cost).toBeCloseTo(1.75, 9);
    expect(e.currency).toBe('USD');
    expect(e.rateUsed?.model).toBe(DEFAULT_MODEL);
  });

  it('REFERENCE rates are staged but NOT active - they require explicit promotion', () => {
    expect(REFERENCE_RATES_2026.length).toBeGreaterThan(0);
    for (const r of REFERENCE_RATES_2026) {
      expect(r.provider).toBe('gemini');
      expect(r.isActive).toBe(false);
      expect(r.sourceRef).toMatch(/^https?:\/\//);
      expect(r.verifiedAt).toBeTruthy();
      expect(r.inputRateUsdPer1M).toBeGreaterThan(0);
      expect(r.outputRateUsdPer1M).toBeGreaterThan(0);
    }
  });

  it('unknown model/rate -> estimatedCostUsd null (honest unknown)', () => {
    const e = estimateCostUsdFromCatalog('gemini', 'unknown-model', 1000, 1000);
    expect(e.cost).toBeNull();
    expect(e.rateUsed).toBeNull();
    expect(e.currency).toBeNull();
  });

  it('known test-fixture rate -> estimatedCostUsd computed correctly (per 1M tokens)', () => {
    const e = estimateCostUsdFromCatalog('gemini', DEFAULT_MODEL, 1000, 1000, [TEST_RATE]);
    // (1000*0.30 + 1000*2.50) / 1_000_000 = 2800 / 1e6 = 0.0028
    expect(e.cost).toBeCloseTo(0.0028, 9);
    expect(e.currency).toBe('USD');
    expect(e.rateUsed?.sourceName).toContain('TEST-ONLY');
  });

  it('missing input/output split (only totalTokens) -> cost null (no faked precision)', () => {
    const e = estimateCostUsdFromCatalog('gemini', DEFAULT_MODEL, null, null, [TEST_RATE]);
    expect(e.cost).toBeNull();
    expect(e.rateUsed).not.toBeNull();
  });

  it('inactive rate is ignored', () => {
    expect(getActiveRate('gemini', DEFAULT_MODEL, [{ ...TEST_RATE, isActive: false }])).toBeNull();
  });

  it('respects the effective window (future effectiveFrom / past effectiveTo)', () => {
    const future = [{ ...TEST_RATE, effectiveFrom: '2999-01-01T00:00:00.000Z' }];
    expect(getActiveRate('gemini', DEFAULT_MODEL, future, new Date('2026-06-14T00:00:00.000Z'))).toBeNull();
    const expired = [{ ...TEST_RATE, effectiveTo: '2026-01-02T00:00:00.000Z' }];
    expect(getActiveRate('gemini', DEFAULT_MODEL, expired, new Date('2026-06-14T00:00:00.000Z'))).toBeNull();
  });

  it('picks the most recent active rate within the window (historical rates allowed)', () => {
    const older = { ...TEST_RATE, effectiveFrom: '2026-01-01T00:00:00.000Z', inputRateUsdPer1M: 0.1 };
    const newer = { ...TEST_RATE, effectiveFrom: '2026-05-01T00:00:00.000Z', inputRateUsdPer1M: 0.9 };
    const r = getActiveRate('gemini', DEFAULT_MODEL, [older, newer], new Date('2026-06-14T00:00:00.000Z'));
    expect(r?.inputRateUsdPer1M).toBe(0.9);
  });
});