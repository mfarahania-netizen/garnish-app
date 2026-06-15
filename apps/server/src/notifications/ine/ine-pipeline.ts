/**
 * INE pipeline (GARNISH-NOTIF-L4-10) — pure, deterministic, explainable. DRY-RUN: decides, never sends.
 *
 * Stages: relevance scorer → timing-fit → fatigue/suppression gate → consent gate → decision. Consent,
 * quiet-hours, and fatigue are HARD gates. Every decision carries WHY + which gates fired.
 */
import { NotificationTrigger } from './notification-triggers';

export interface UserNotificationState {
  userId: string;
  hour: number; // current local hour 0..23
  openAffinity: number; // 0..1 (tendency to open notifications; cold-start default ~0.4)
  dismissFatigue: number; // 0..1 (higher = more fatigued)
  quietHours: { start: number; end: number }; // e.g. { start: 22, end: 7 }
  activeHours: number[]; // hours the user tends to be active (from routine/meal pattern)
  sentLast24h: number;
  recentDismissals: number;
  sentThisWeekByTrigger: Record<string, number>;
  consents: string[]; // granted consent purposes (core always present)
  dailyCap: number; // max notifications/day (default 2)
}

export type IneDecisionType = 'send' | 'suppress' | 'defer';

export interface IneDecision {
  userId: string;
  triggerKey: string;
  decision: IneDecisionType;
  relevance: number;
  sendWindowHour: number | null;
  gates: { consent: boolean; quietHours: boolean; fatigue: boolean; relevance: boolean };
  reasons: string[];
  content: { title: string; body: string } | null;
  dryRun: true;
}

const RELEVANCE_FLOOR = 0.3;

export function inQuietHours(hour: number, q: { start: number; end: number }): boolean {
  // quiet window may wrap midnight (e.g. 22→7)
  return q.start <= q.end ? hour >= q.start && hour < q.end : hour >= q.start || hour < q.end;
}

/** Best send hour: the next active hour that is NOT in quiet hours (today), else null. */
export function fitTiming(state: UserNotificationState): { hour: number | null; nowOk: boolean } {
  const candidates = (state.activeHours.length ? state.activeHours : [9, 12, 18, 20])
    .filter((h) => !inQuietHours(h, state.quietHours))
    .sort((a, b) => a - b);
  if (candidates.length === 0) return { hour: null, nowOk: false };
  const nowOk = !inQuietHours(state.hour, state.quietHours) && candidates.includes(nearestActive(state.hour, candidates));
  const upcoming = candidates.find((h) => h >= state.hour);
  return { hour: upcoming ?? candidates[0], nowOk };
}
function nearestActive(hour: number, active: number[]): number {
  return active.reduce((best, h) => (Math.abs(h - hour) < Math.abs(best - hour) ? h : best), active[0]);
}

export function scoreRelevance(trigger: NotificationTrigger, state: UserNotificationState): number {
  let score = trigger.priority / 10; // base from priority
  score *= 0.6 + 0.4 * clamp01(state.openAffinity); // weight by how much the user opens notifications
  score -= 0.3 * clamp01(state.dismissFatigue); // fatigued users get lower relevance
  return Number(clamp01(score).toFixed(3));
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function decide(trigger: NotificationTrigger, state: UserNotificationState, payload?: Record<string, any>): IneDecision {
  const reasons: string[] = [];
  const gates = { consent: true, quietHours: true, fatigue: true, relevance: true };

  // F. CONSENT (hard) — 'core' is operational and always granted
  const consentOk = trigger.consentPurpose === 'core' || state.consents.includes(trigger.consentPurpose);
  gates.consent = consentOk;
  if (!consentOk) {
    reasons.push(`no consent for "${trigger.consentPurpose}"`);
    return finalize('suppress', null, 0, gates, reasons, trigger, payload, false);
  }

  // C. RELEVANCE
  const relevance = scoreRelevance(trigger, state);
  if (relevance < RELEVANCE_FLOOR) {
    gates.relevance = false;
    reasons.push(`low relevance (${relevance} < ${RELEVANCE_FLOOR})`);
    return finalize('suppress', relevance, relevance, gates, reasons, trigger, payload, false);
  }

  // E. FATIGUE / SUPPRESSION (hard)
  if (state.sentLast24h >= state.dailyCap) { gates.fatigue = false; reasons.push(`daily cap reached (${state.sentLast24h}/${state.dailyCap} in 24h)`); }
  if (state.recentDismissals >= 2) { gates.fatigue = false; reasons.push(`recent dismissals (${state.recentDismissals})`); }
  if ((state.sentThisWeekByTrigger[trigger.key] ?? 0) >= trigger.maxPerWeek) { gates.fatigue = false; reasons.push(`weekly cap for ${trigger.key} (${state.sentThisWeekByTrigger[trigger.key]}/${trigger.maxPerWeek})`); }
  if (!gates.fatigue) return finalize('suppress', relevance, relevance, gates, reasons, trigger, payload, false);

  // D. TIMING-FIT (quiet hours hard) — never send during quiet hours
  const timing = fitTiming(state);
  const quietNow = inQuietHours(state.hour, state.quietHours);
  gates.quietHours = !quietNow;
  if (quietNow || (timing.hour != null && timing.hour > state.hour)) {
    reasons.push(quietNow ? `quiet hours now (${state.hour}:00) — deferred to ~${timing.hour}:00` : `best window ~${timing.hour}:00`);
    return finalize('defer', relevance, relevance, gates, reasons, trigger, payload, true, timing.hour);
  }

  reasons.push(`relevant (${relevance}) + good time (~${timing.hour ?? state.hour}:00) + within frequency caps`);
  return finalize('send', relevance, relevance, gates, reasons, trigger, payload, true, timing.hour ?? state.hour);
}

function finalize(decision: IneDecisionType, _r: number | null, relevance: number, gates: IneDecision['gates'], reasons: string[], trigger: NotificationTrigger, payload: Record<string, any> | undefined, withContent: boolean, sendWindowHour: number | null = null): IneDecision {
  return {
    userId: '',
    triggerKey: trigger.key,
    decision,
    relevance,
    sendWindowHour: decision === 'suppress' ? null : sendWindowHour,
    gates,
    reasons,
    content: withContent ? trigger.template(payload) : null,
    dryRun: true,
  };
}
