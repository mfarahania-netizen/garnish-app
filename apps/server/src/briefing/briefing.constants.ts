/**
 * HABIT-L4-12 — Briefing event types (additive). Logged via the EXISTING analytics ingest
 * (AnalyticsService.trackEvent → UserEvent → signal/profile loop). No EventType-enum/contract change,
 * no migration: UserEvent.type is a free string, so the briefing becomes a learning signal additively.
 */
export const BRIEFING_EVENTS = {
  view: 'briefing_view',
  accept: 'briefing_accept',
  reject: 'briefing_reject',
  swap: 'briefing_swap',
} as const;

export type BriefingFeedbackAction = 'accept' | 'reject' | 'swap';
export const BRIEFING_FEEDBACK_ACTIONS: readonly BriefingFeedbackAction[] = ['accept', 'reject', 'swap'];

export const INACTIVE_REENGAGE_DAYS = 7; // a quiet stretch before a KIND, fatigue-capped re-engagement
