import {
  PRODUCTION_RATE_CATALOG,
  getActiveRate,
  estimateCostUsdFromCatalog,
  AiModelRate,
  RATE_CATALOG_SCHEMA_VERSION,
} from './ai-cost-rate-catalog';

/** TEST-ONLY fixture rate — clearly NOT production truth (no verified source). */
const TEST_RATE: AiModelRate = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
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
  it('production catalog ships EMPTY (no invented prices)', () => {
    expect(PRODUCTION_RATE_CATALOG).toEqual([]);
  });

  it('unknown model/rate → estimatedCostUsd null (production catalog)', () => {
    const e = estimateCostUsdFromCatalog('gemini', 'gemini-2.5-flash', 1000, 1000);
    expect(e.cost).toBeNull();
    expect(e.rateUsed).toBeNull();
    expect(e.currency).toBeNull();
  });

  it('known test-fixture rate → estimatedCostUsd computed correctly (per 1M tokens)', () => {
    const e = estimateCostUsdFromCatalog('gemini', 'gemini-2.5-flash', 1000, 1000, [TEST_RATE]);
    // (1000*0.30 + 1000*2.50) / 1_000_000 = 2800 / 1e6 = 0.0028
    expect(e.cost).toBeCloseTo(0.0028, 9);
    expect(e.currency).toBe('USD');
    expect(e.rateUsed?.sourceName).toContain('TEST-ONLY');
  });

  it('missing input/output split (only totalTokens) → cost null (no faked precision)', () => {
    const e = estimateCostUsdFromCatalog('gemini', 'gemini-2.5-flash', null, null, [TEST_RATE]);
    expect(e.cost).toBeNull();
    expect(e.rateUsed).not.toBeNull(); // a rate exists, but we refuse to fake the split
  });

  it('inactive rate is ignored', () => {
    expect(getActiveRate('gemini', 'gemini-2.5-flash', [{ ...TEST_RATE, isActive: false }])).toBeNull();
  });

  it('respects the effective window (future effectiveFrom / past effectiveTo)', () => {
    const future = [{ ...TEST_RATE, effectiveFrom: '2999-01-01T00:00:00.000Z' }];
    expect(getActiveRate('gemini', 'gemini-2.5-flash', future, new Date('2026-06-14T00:00:00.000Z'))).toBeNull();
    const expired = [{ ...TEST_RATE, effectiveTo: '2026-01-02T00:00:00.000Z' }];
    expect(getActiveRate('gemini', 'gemini-2.5-flash', expired, new Date('2026-06-14T00:00:00.000Z'))).toBeNull();
  });

  it('picks the most recent active rate within the window (historical rates allowed)', () => {
    const older = { ...TEST_RATE, effectiveFrom: '2026-01-01T00:00:00.000Z', inputRateUsdPer1M: 0.1 };
    const newer = { ...TEST_RATE, effectiveFrom: '2026-05-01T00:00:00.000Z', inputRateUsdPer1M: 0.9 };
    const r = getActiveRate('gemini', 'gemini-2.5-flash', [older, newer], new Date('2026-06-14T00:00:00.000Z'));
    expect(r?.inputRateUsdPer1M).toBe(0.9);
  });
});
