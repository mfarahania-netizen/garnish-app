import { extractSignalObservations } from './signal-observation-engine';
import {
  CanonicalEventEnvelope,
  ActorTypeEnum,
  EventSourceEnum,
  VisibilityEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
} from '../../analytics/event-envelope.schema';
import { isSafeExplanation } from './signal-explainability';

const USER = 'user_1';
const NOW = new Date('2026-06-14T00:00:00.000Z');
const ISO = (d: Date) => d.toISOString();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

let n = 0;
function ev(eventType: string, o: any = {}): CanonicalEventEnvelope {
  n++;
  const occurredAt = o.occurredAt ?? ISO(daysAgo(1));
  return {
    eventId: `e${n}`,
    eventType,
    actorType: ActorTypeEnum.user,
    actorId: USER,
    subjectType: 'user',
    subjectId: o.subjectId ?? USER,
    source: EventSourceEnum.server,
    visibility: VisibilityEnum.private,
    consentPurpose: o.consentPurpose ?? 'personalization',
    schemaVersion: 2,
    occurredAt,
    receivedAt: occurredAt,
    privacyClass: o.privacyClass ?? PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    ...(o.metadata ? { metadata: o.metadata } : {}),
  } as CanonicalEventEnvelope;
}

const run = (events: unknown[], opts: any = {}) =>
  extractSignalObservations(events, { mode: 'offline_eval', userId: USER, now: NOW, includePlannedSignals: true, ...opts });

describe('E43-A3 signal observation engine', () => {
  it('produces a valid SignalObservation shape', () => {
    const o = run([ev('favorite_add')]).observations.find((x) => x.signalKey === 'reco.save_affinity')!;
    expect(o).toBeDefined();
    expect(o.version).toBe(1);
    expect(o.observationId).toBe('user_1:reco.save_affinity');
    expect(o.strength).toBeGreaterThanOrEqual(-1);
    expect(o.strength).toBeLessThanOrEqual(1);
    expect(o.confidence).toBeGreaterThanOrEqual(0);
    expect(o.confidence).toBeLessThanOrEqual(1);
    expect(o.evidenceCount).toBe(o.evidenceEventIds.length);
    expect(isSafeExplanation(o.explanation)).toBe(true);
  });

  it('emits zero observations for an empty/garbage input without throwing', () => {
    expect(() => run([])).not.toThrow();
    expect(run([]).observations).toEqual([]);
    expect(() => run([null, 42, 'x', {}])).not.toThrow();
    expect(run([null, 42, 'x', {}]).observations).toEqual([]);
  });

  it('skips events for other users', () => {
    expect(run([ev('favorite_add', { subjectId: 'someone_else' })]).observations).toEqual([]);
  });

  it('skips invalid/PII events and records a redacted failure', () => {
    const res = run([ev('favorite_add', { metadata: { email: 'a@b.co' } })]);
    expect(res.observations).toEqual([]);
    expect(res.redactedFailureDetails.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(res.redactedFailureDetails)).not.toMatch(/a@b\.co/);
  });

  it('enforces consent: personalization signal not emitted from analytics-only consent', () => {
    expect(run([ev('favorite_add', { consentPurpose: 'analytics' })]).observations.some((o) => o.signalKey === 'reco.save_affinity')).toBe(false);
  });

  it('emits personalization signal when consent is personalization', () => {
    expect(run([ev('favorite_add', { consentPurpose: 'personalization' })]).observations.some((o) => o.signalKey === 'reco.save_affinity')).toBe(true);
  });

  it('never downgrades privacy: P2 source -> P2 observation', () => {
    const o = run([ev('recipe_view', { privacyClass: 'P2-sensitive' })]).observations.find((x) => x.signalKey === 'taste.cuisine_affinity');
    expect(o?.privacyClass).toBe('P2-sensitive');
  });

  it('positive direction yields positive strength; negative yields negative', () => {
    const pos = run([ev('favorite_add'), ev('favorite_add'), ev('favorite_add')]).observations.find((o) => o.signalKey === 'reco.save_affinity')!;
    const neg = run([ev('recommendation_dismiss'), ev('recommendation_dismiss')]).observations.find((o) => o.signalKey === 'reco.dismiss_avoidance')!;
    expect(pos.strength).toBeGreaterThan(0);
    expect(neg.strength).toBeLessThan(0);
  });

  it('is deterministic and ordered by signalKey', () => {
    const events = [ev('favorite_add'), ev('recipe_view'), ev('recommendation_click')];
    const a = run(events).observations;
    const b = run(events).observations;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.map((o) => o.signalKey)).toEqual([...a.map((o) => o.signalKey)].sort());
  });

  it('excludes planned signals unless includePlannedSignals is true', () => {
    const withoutPlanned = extractSignalObservations([ev('cook_complete')], { mode: 'shadow', userId: USER, now: NOW });
    const withPlanned = run([ev('cook_complete')]);
    expect(withoutPlanned.observations.some((o) => o.signalKey === 'skill.cook_completion_growth')).toBe(false);
    expect(withPlanned.observations.some((o) => o.signalKey === 'skill.cook_completion_growth')).toBe(true);
  });

  it('observations never contain raw user text / PII', () => {
    const json = JSON.stringify(run([ev('favorite_add'), ev('ai_message_send'), ev('recipe_view')]).observations);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
  });
});
