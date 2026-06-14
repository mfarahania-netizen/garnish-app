import { analyzeRecommendationShadowTraces } from './recommendation-shadow-online-analysis';
import { ShadowTraceReadPort, RedactedTraceRow } from './recommendation-shadow-profile-feed.types';

const Q = { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-06-14T00:00:00.000Z') };
const rows = (n: number, major = 0): RedactedTraceRow[] =>
  Array.from({ length: n }, (_, i) => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i < major, reasonCodes: ['novelty_boost', i % 2 ? 'recent_overexposure' : 'dismiss_history'], summary: { weakConfidenceCount: i % 3 === 0 ? 1 : 0 } }));

describe('analyzeRecommendationShadowTraces', () => {
  it('mode off → empty analysis', async () => {
    const r = await analyzeRecommendationShadowTraces(Q, { mode: 'off' });
    expect(r.traceCount).toBe(0);
    expect(r.sampleSizeWarning).toBe(true);
    expect(r.productUseEnabled).toBe(false);
  });

  it('read_only with no port → empty', async () => {
    const r = await analyzeRecommendationShadowTraces(Q, { mode: 'read_only' });
    expect(r.traceCount).toBe(0);
  });

  it('empty table → safe empty analysis', async () => {
    const port: ShadowTraceReadPort = { readTraces: async () => [] };
    const r = await analyzeRecommendationShadowTraces(Q, { mode: 'read_only', port });
    expect(r.traceCount).toBe(0);
    expect(r.limitations.join(' ')).toMatch(/No traces/i);
  });

  it('aggregates overlap, divergence rate, reason codes', async () => {
    const port: ShadowTraceReadPort = { readTraces: async () => rows(40, 10) };
    const r = await analyzeRecommendationShadowTraces(Q, { mode: 'read_only', port });
    expect(r.traceCount).toBe(40);
    expect(r.averageTopKOverlap).toBeCloseTo(0.5, 5);
    expect(r.majorDivergenceRate).toBeCloseTo(0.25, 5);
    expect(r.mostCommonReasonCodes[0].count).toBeGreaterThan(0);
    expect(r.sampleSizeWarning).toBe(false);
  });

  it('small sample → sampleSizeWarning true', async () => {
    const port: ShadowTraceReadPort = { readTraces: async () => rows(5) };
    const r = await analyzeRecommendationShadowTraces(Q, { mode: 'read_only', port });
    expect(r.sampleSizeWarning).toBe(true);
  });

  it('never exposes raw trace body and never throws', async () => {
    const port: ShadowTraceReadPort = { readTraces: async () => { throw new Error('db'); } };
    const r = await analyzeRecommendationShadowTraces(Q, { mode: 'read_only', port });
    expect(r.traceCount).toBe(0);
    expect(JSON.stringify(r)).not.toMatch(/instruction|recipeBody|userText|prompt/i);
  });
});
