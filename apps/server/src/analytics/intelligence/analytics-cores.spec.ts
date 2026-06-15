import { computeFunnel } from './funnel';
import { bucketTimeSeries } from './trends';
import { computeCohortRetention } from './cohort';

describe('funnel (drop-off, honest)', () => {
  it('computes drop-off per stage + overall conversion from real counts', () => {
    const f = computeFunnel('cook', [
      { key: 'view', label: 'Viewed', count: 100 },
      { key: 'start', label: 'Started cooking', count: 40 },
      { key: 'complete', label: 'Completed', count: 25 },
    ]);
    expect(f.status).toBe('real');
    expect(f.stages[1].dropOffFromPrev).toBe(0.6);
    expect(f.stages[2].conversionFromStart).toBe(0.25);
    expect(f.overallConversion).toBe(0.25);
  });

  it('HONEST: an empty funnel (no entrants) is awaiting_pilot, not 0%', () => {
    const f = computeFunnel('onboarding', [{ key: 'register', label: 'x', count: 0 }, { key: 'done', label: 'y', count: 0 }]);
    expect(f.status).toBe('awaiting_pilot');
    expect(f.overallConversion).toBeNull();
  });
});

describe('trends (deterministic time buckets)', () => {
  const evts = [
    { type: 'cook_complete', timestamp: '2026-06-14T10:00:00Z' },
    { type: 'cook_complete', timestamp: '2026-06-14T20:00:00Z' },
    { type: 'cook_complete', timestamp: '2026-06-15T09:00:00Z' },
    { type: 'search_query', timestamp: '2026-06-15T09:00:00Z' },
  ];
  const NOW = new Date('2026-06-16T00:00:00Z');

  it('buckets per day per type deterministically', () => {
    const t = bucketTimeSeries(evts, { bucket: 'day', sinceDays: 30, types: ['cook_complete', 'search_query'], now: NOW });
    expect(t.status).toBe('real');
    expect(t.series.cook_complete).toEqual([{ bucketStart: '2026-06-14', count: 2 }, { bucketStart: '2026-06-15', count: 1 }]);
    expect(t.series.search_query).toEqual([{ bucketStart: '2026-06-15', count: 1 }]);
    expect(JSON.stringify(bucketTimeSeries(evts, { bucket: 'day', sinceDays: 30, types: ['cook_complete'], now: NOW }))).toBe(JSON.stringify(bucketTimeSeries(evts, { bucket: 'day', sinceDays: 30, types: ['cook_complete'], now: NOW })));
  });

  it('HONEST: no matching events → awaiting_pilot empty series', () => {
    const t = bucketTimeSeries([], { bucket: 'day', sinceDays: 30, types: ['cook_complete'], now: NOW });
    expect(t.status).toBe('awaiting_pilot');
    expect(t.totalEvents).toBe(0);
  });
});

describe('cohort retention (honest-null pre-pilot)', () => {
  it('HONEST: no signups → awaiting_pilot (NOT a fabricated curve)', () => {
    const c = computeCohortRetention([], []);
    expect(c.status).toBe('awaiting_pilot');
    expect(c.cohorts).toEqual([]);
  });

  it('computes Wn retention from real signups + activity', () => {
    const signupAt = '2026-06-01T00:00:00Z'; // a Monday-ish cohort
    const signups = [{ userId: 'u1', signupAt }, { userId: 'u2', signupAt }];
    const activity = [
      { userId: 'u1', at: '2026-06-09T00:00:00Z' }, // ~W1 later
    ];
    const c = computeCohortRetention(signups, activity, [1, 2]);
    expect(c.status).toBe('real');
    expect(c.cohorts.length).toBe(1);
    expect(c.cohorts[0].size).toBe(2);
    expect(c.cohorts[0].retention.W1).toBeGreaterThanOrEqual(0);
    expect(c.cohorts[0].retention.W1).toBeLessThanOrEqual(1);
  });
});
