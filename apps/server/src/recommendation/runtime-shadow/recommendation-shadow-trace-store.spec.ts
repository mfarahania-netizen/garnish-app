import { NoopRecommendationShadowTraceStore, PrismaRecommendationShadowTraceStore, ShadowTracePrismaClient } from './recommendation-shadow-trace-store';
import { RedactedRecommendationShadowTrace } from './recommendation-shadow-input-provider.types';

const cleanTrace = (): RedactedRecommendationShadowTrace => ({
  decisionId: 'u:home', userId: 'u', requestId: 'r', experimentKey: 'a7-shadow-v1',
  liveFingerprint: '0:r1', shadowFingerprint: '0:r2', topKOverlap: 0.5, rankShiftCount: 1, majorDivergence: false,
  reasonCodes: ['novelty_boost'],
  summary: { liveCandidateCount: 1, shadowCandidateCount: 1, weakConfidenceCount: 0, unsafeExplanationCount: 0, readinessStatus: 'ready_shadow', safetyAllowed: true },
  readinessStatus: 'ready_shadow', safetyAllowed: true, generatedAt: '2026-06-14T00:00:00.000Z', productUseEnabled: false, version: 1,
});

describe('NoopRecommendationShadowTraceStore', () => {
  it('never writes', async () => {
    const r = await new NoopRecommendationShadowTraceStore().writeTrace(cleanTrace(), 'redacted');
    expect(r.written).toBe(false);
  });
});

describe('PrismaRecommendationShadowTraceStore', () => {
  function mkClient() {
    const create = jest.fn().mockResolvedValue({ id: 'x' });
    const client: ShadowTracePrismaClient = { recommendationShadowTrace: { create } };
    return { client, create };
  }

  it('off mode never writes', async () => {
    const { client, create } = mkClient();
    const r = await new PrismaRecommendationShadowTraceStore(client).writeTrace(cleanTrace(), 'off');
    expect(r.written).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('redacted mode writes a clean trace (no raw content columns)', async () => {
    const { client, create } = mkClient();
    const r = await new PrismaRecommendationShadowTraceStore(client).writeTrace(cleanTrace(), 'redacted');
    expect(r.written).toBe(true);
    const data = create.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(['experimentKey', 'liveFingerprint', 'majorDivergence', 'rankShiftCount', 'reasonCodes', 'requestId', 'shadowFingerprint', 'summary', 'topKOverlap', 'userId'].sort());
    expect(JSON.stringify(data)).not.toMatch(/instruction|description|steps|prompt/i);
  });

  it('refuses to write a trace that fails the cleanliness guard', async () => {
    const { client, create } = mkClient();
    const dirty = { ...cleanTrace(), liveFingerprint: 'token eyJabcdefghij1234567890' };
    const r = await new PrismaRecommendationShadowTraceStore(client).writeTrace(dirty as any, 'redacted');
    expect(r.written).toBe(false);
    expect(r.errorKind).toBe('unsafe_trace');
    expect(create).not.toHaveBeenCalled();
  });

  it('swallows DB errors into a result (no throw, no raw message)', async () => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('connection string postgres://secret'), { code: 'P2002' }));
    const r = await new PrismaRecommendationShadowTraceStore({ recommendationShadowTrace: { create } }).writeTrace(cleanTrace(), 'redacted');
    expect(r.written).toBe(false);
    expect(r.errorKind).toBe('P2002');
    expect(JSON.stringify(r)).not.toMatch(/postgres:\/\//);
  });
});
