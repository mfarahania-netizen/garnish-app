/**
 * INE consolidated QA gate (GARNISH-NOTIF-L4-10). Runs the dry-run simulator over diverse personas and
 * asserts the engine's safety invariants: ZERO real sends, consent/quiet/fatigue HARD gates fire, every
 * decision is explainable, and content is never medical. Writes an evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runIneSimulation, SimPersona } from './ine-simulator';
import { UserNotificationState } from './ine-pipeline';
import { checkTriggerRegistry, NOTIFICATION_TRIGGERS } from './notification-triggers';

const state = (over: Partial<UserNotificationState>): UserNotificationState => ({
  userId: 'p', hour: 12, openAffinity: 0.7, dismissFatigue: 0.05, quietHours: { start: 22, end: 7 },
  activeHours: [12, 18, 20], sentLast24h: 0, recentDismissals: 0, sentThisWeekByTrigger: {}, consents: ['core', 'personalization'], dailyCap: 2, ...over,
});

const PERSONAS: SimPersona[] = [
  { name: 'active-consented-noon', state: state({ hour: 12 }), candidates: [{ triggerKey: 'meal_time_nudge' }, { triggerKey: 'shopping_unchecked', payload: { count: 4 } }] },
  { name: 'quiet-hours-night', state: state({ hour: 23 }), candidates: [{ triggerKey: 'meal_time_nudge' }] },
  { name: 'no-personalization-consent', state: state({ consents: ['core'] }), candidates: [{ triggerKey: 'discovery_similar' }, { triggerKey: 'churn_reengagement' }] },
  { name: 'fatigued-daily-cap', state: state({ sentLast24h: 2, dailyCap: 2 }), candidates: [{ triggerKey: 'shopping_unchecked', payload: { count: 2 } }] },
  { name: 'dismisser', state: state({ recentDismissals: 3 }), candidates: [{ triggerKey: 'weekly_plan_gap' }] },
  { name: 'early-morning-defer', state: state({ hour: 8, activeHours: [12, 18] }), candidates: [{ triggerKey: 'meal_time_nudge' }] },
  { name: 'weekly-capped', state: state({ sentThisWeekByTrigger: { discovery_similar: 2 } }), candidates: [{ triggerKey: 'discovery_similar' }] },
];

describe('INE QA gate', () => {
  const report = runIneSimulation(PERSONAS);

  it('trigger registry is consistent and content is non-medical', () => {
    const c = checkTriggerRegistry();
    expect(c.ok).toBe(true);
    expect(NOTIFICATION_TRIGGERS.length).toBeGreaterThanOrEqual(6);
  });

  it('SAFETY: a simulation performs ZERO real sends (dry-run only)', () => {
    expect(report.realSends).toBe(0);
    expect(report.decisions.every((d) => d.dryRun === true)).toBe(true);
  });

  it('exercises all three decision outcomes (send / suppress / defer)', () => {
    expect(report.wouldSend).toBeGreaterThan(0);
    expect(report.suppressed).toBeGreaterThan(0);
    expect(report.deferred).toBeGreaterThan(0);
  });

  it('each HARD gate is observed firing across the personas', () => {
    const blocked = (g: keyof (typeof report.decisions)[number]['gates']) => report.decisions.some((d) => d.gates[g] === false);
    expect(blocked('consent')).toBe(true);
    expect(blocked('quietHours')).toBe(true);
    expect(blocked('fatigue')).toBe(true);
  });

  it('every decision is explainable (carries at least one reason)', () => {
    expect(report.decisions.every((d) => d.reasons.length > 0)).toBe(true);
  });

  it('consent-suppressed decisions never compose content', () => {
    expect(report.decisions.filter((d) => d.gates.consent === false).every((d) => d.content === null)).toBe(true);
  });

  it('writes the evidence artifact', () => {
    const checks = {
      registry_consistent: checkTriggerRegistry().ok,
      zero_real_sends: report.realSends === 0,
      all_dry_run: report.decisions.every((d) => d.dryRun === true),
      has_send: report.wouldSend > 0,
      has_suppress: report.suppressed > 0,
      has_defer: report.deferred > 0,
      consent_gate_fires: report.decisions.some((d) => d.gates.consent === false),
      quiet_gate_fires: report.decisions.some((d) => d.gates.quietHours === false),
      fatigue_gate_fires: report.decisions.some((d) => d.gates.fatigue === false),
      all_explainable: report.decisions.every((d) => d.reasons.length > 0),
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-NOTIF-L4-10', engine: 'NotificationIntelligenceEngine', mode: 'DRY-RUN', totalChecks: Object.keys(checks).length, failedChecks, checks, report };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(10);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/notifications');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_notif_l4_10_ine_dry_run_results.json'), JSON.stringify(artifact, null, 2));
  });
});
