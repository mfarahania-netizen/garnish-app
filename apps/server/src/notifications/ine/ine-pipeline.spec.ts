import { decide, scoreRelevance, fitTiming, inQuietHours, UserNotificationState } from './ine-pipeline';
import { getTrigger, checkTriggerRegistry, NOTIFICATION_TRIGGERS } from './notification-triggers';

const baseState = (over: Partial<UserNotificationState> = {}): UserNotificationState => ({
  userId: 'u1', hour: 12, openAffinity: 0.6, dismissFatigue: 0.1, quietHours: { start: 22, end: 7 },
  activeHours: [12, 18, 20], sentLast24h: 0, recentDismissals: 0, sentThisWeekByTrigger: {}, consents: ['core', 'personalization'], dailyCap: 2, ...over,
});
const meal = getTrigger('meal_time_nudge')!; // core
const discovery = getTrigger('discovery_similar')!; // personalization

describe('trigger registry', () => {
  it('is consistent + has non-medical content', () => {
    const c = checkTriggerRegistry();
    expect(c.ok).toBe(true);
    expect(c.issues).toEqual([]);
    expect(NOTIFICATION_TRIGGERS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('helpers', () => {
  it('inQuietHours handles a midnight-wrapping window', () => {
    expect(inQuietHours(23, { start: 22, end: 7 })).toBe(true);
    expect(inQuietHours(3, { start: 22, end: 7 })).toBe(true);
    expect(inQuietHours(12, { start: 22, end: 7 })).toBe(false);
  });
  it('scoreRelevance rewards open-affinity, penalizes fatigue', () => {
    expect(scoreRelevance(meal, baseState({ openAffinity: 0.9, dismissFatigue: 0 }))).toBeGreaterThan(scoreRelevance(meal, baseState({ openAffinity: 0.2, dismissFatigue: 0.8 })));
  });
  it('fitTiming picks the next active non-quiet hour', () => {
    expect(fitTiming(baseState({ hour: 8, activeHours: [12, 18] })).hour).toBe(12);
  });
});

describe('decide — HARD gates', () => {
  it('CONSENT: a personalization trigger is SUPPRESSED without personalization consent', () => {
    const d = decide(discovery, baseState({ consents: ['core'] }));
    expect(d.decision).toBe('suppress');
    expect(d.gates.consent).toBe(false);
    expect(d.reasons.join(' ')).toMatch(/consent/);
    expect(d.content).toBeNull(); // no content composed for a consent-blocked decision
  });

  it('QUIET HOURS: never sends during quiet hours — defers to the next window', () => {
    const d = decide(meal, baseState({ hour: 23 }));
    expect(d.decision).toBe('defer');
    expect(d.gates.quietHours).toBe(false);
    expect(d.reasons.join(' ')).toMatch(/quiet/);
  });

  it('FATIGUE: daily cap reached → suppress', () => {
    const d = decide(meal, baseState({ sentLast24h: 2, dailyCap: 2 }));
    expect(d.decision).toBe('suppress');
    expect(d.gates.fatigue).toBe(false);
  });

  it('FATIGUE: recent dismissals → suppress', () => {
    expect(decide(meal, baseState({ recentDismissals: 2 })).decision).toBe('suppress');
  });

  it('FATIGUE: per-trigger weekly cap → suppress', () => {
    const d = decide(discovery, baseState({ sentThisWeekByTrigger: { discovery_similar: 2 } }));
    expect(d.decision).toBe('suppress');
  });

  it('LOW RELEVANCE → suppress', () => {
    const d = decide(discovery, baseState({ openAffinity: 0.2, dismissFatigue: 0.6 }));
    expect(d.decision).toBe('suppress');
    expect(d.gates.relevance).toBe(false);
  });
});

describe('decide — happy path', () => {
  it('relevant + good time + consented + within caps → SEND with content + window', () => {
    const d = decide(meal, baseState({ hour: 12 }));
    expect(d.decision).toBe('send');
    expect(d.gates).toEqual({ consent: true, quietHours: true, fatigue: true, relevance: true });
    expect(d.sendWindowHour).toBe(12);
    expect(d.content?.title).toBeTruthy();
    expect(d.dryRun).toBe(true);
  });

  it('good but a future window → DEFER (not send now)', () => {
    const d = decide(meal, baseState({ hour: 8, activeHours: [12, 18] }));
    expect(d.decision).toBe('defer');
    expect(d.sendWindowHour).toBe(12);
  });
});
