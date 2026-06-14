import { loadRecommendationShadowProfileFeed } from './recommendation-shadow-profile-feed';
import { ShadowProfileFeedPort } from './recommendation-shadow-profile-feed.types';
import { makeObs } from '../../behavior-engine/profile/profile-simulation-fixtures';

const NOW = new Date('2026-06-14T12:00:00.000Z');

describe('loadRecommendationShadowProfileFeed', () => {
  it('mode off → off status, null graph', async () => {
    const r = await loadRecommendationShadowProfileFeed('u', undefined, { mode: 'off', now: NOW });
    expect(r.status).toBe('off');
    expect(r.graph).toBeNull();
    expect(r.source).toBe('none');
    expect(r.safeForShadowScoring).toBe(false);
  });

  it('rebuild with no persisted signals → cold-start fallback (never fabricates)', async () => {
    const port: ShadowProfileFeedPort = { loadObservations: async () => null };
    const r = await loadRecommendationShadowProfileFeed('u', undefined, { mode: 'rebuild', port, now: NOW });
    expect(r.source).toBe('cold_start_fallback');
    expect(r.status).toBe('missing');
    expect(r.graph).not.toBeNull();
    expect(r.missingInputs).toContain('signalObservations');
    expect(r.safeForShadowScoring).toBe(true);
  });

  it('rebuild from persisted observations → builds a graph (rebuild_from_signals)', async () => {
    const observations = [
      makeObs('u', { key: 'taste.cuisine_exploration', strength: 0.7, confidence: 0.7, evidenceCount: 6 }, NOW),
      makeObs('u', { key: 'effort.quick_meal_preference', strength: 0.5, confidence: 0.6, evidenceCount: 5 }, NOW),
      makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.7, evidenceCount: 5 }, NOW),
    ];
    const port: ShadowProfileFeedPort = { loadObservations: async () => ({ observations, source: 'rebuild_from_signals', signalCount: 20, snapshotAgeHours: null }) };
    const r = await loadRecommendationShadowProfileFeed('u', undefined, { mode: 'rebuild', port, now: NOW });
    expect(r.source).toBe('rebuild_from_signals');
    expect(['partial', 'ready']).toContain(r.status);
    expect(r.graph).not.toBeNull();
    expect(r.observationCount).toBe(3);
    expect(r.limitations.join(' ')).toMatch(/approximate/i);
  });

  it('persisted snapshot path flags staleness when old', async () => {
    const observations = [makeObs('u', { key: 'reco.save_affinity', strength: 0.2, confidence: 0.5 }, NOW)];
    const port: ShadowProfileFeedPort = { loadObservations: async () => ({ observations, source: 'persisted_snapshot', signalCount: 1, snapshotAgeHours: 300 }) };
    const r = await loadRecommendationShadowProfileFeed('u', undefined, { mode: 'persisted', port, now: NOW });
    expect(r.source).toBe('persisted_snapshot');
    expect(r.snapshotAgeHours).toBe(300);
    expect(r.limitations.join(' ')).toMatch(/stale|older than/i);
  });

  it('never includes raw event payload / user text (graph is dimensional only)', async () => {
    const observations = [makeObs('u', { key: 'taste.cuisine_exploration', strength: 0.5, confidence: 0.6 }, NOW)];
    const port: ShadowProfileFeedPort = { loadObservations: async () => ({ observations, source: 'rebuild_from_signals', signalCount: 3, snapshotAgeHours: null }) };
    const r = await loadRecommendationShadowProfileFeed('u', undefined, { mode: 'rebuild', port, now: NOW });
    expect(JSON.stringify(r.graph)).not.toMatch(/rawPayload|userText|prompt|instruction/i);
  });

  it('port throwing → cold-start fallback, never throws', async () => {
    const port: ShadowProfileFeedPort = { loadObservations: async () => { throw new Error('db'); } };
    const r = await loadRecommendationShadowProfileFeed('u', undefined, { mode: 'rebuild', port, now: NOW });
    expect(r.source).toBe('cold_start_fallback');
  });

  it('no userId → cold-start, no throw', async () => {
    const r = await loadRecommendationShadowProfileFeed('', undefined, { mode: 'rebuild', now: NOW });
    expect(r.source).toBe('cold_start_fallback');
  });
});
