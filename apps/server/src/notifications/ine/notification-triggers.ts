/**
 * Notification Intelligence Engine — trigger registry + shared types (GARNISH-NOTIF-L4-10).
 *
 * The typed catalog of notification triggers: eligibility is resolved live by the service; each entry
 * carries a content template (templated, NON-medical), a priority, the consent purpose it requires, and
 * a frequency cap. The registry is guarded so no trigger content can carry a medical/diagnostic claim.
 * Pure types + data only.
 */

export type IneConsentPurpose = 'core' | 'analytics' | 'personalization';

export interface NotificationTrigger {
  key: string;
  description: string;
  priority: number; // 1..10 (higher = more important)
  consentPurpose: IneConsentPurpose; // HARD consent gate
  maxPerWeek: number; // frequency cap per trigger
  /** safe, non-medical content template. payload is trigger-specific (resolved live). */
  template: (payload?: Record<string, any>) => { title: string; body: string };
}

export const NOTIFICATION_TRIGGERS: readonly NotificationTrigger[] = [
  {
    key: 'shopping_unchecked',
    description: 'The shopping list has unchecked items.',
    priority: 6,
    consentPurpose: 'core',
    maxPerWeek: 5,
    template: (p) => ({ title: 'لیست خرید', body: `${p?.count ?? 'چند'} مورد در لیست خریدت تیک نخورده.` }),
  },
  {
    key: 'meal_time_nudge',
    description: "It's near a meal time and today's slot is empty.",
    priority: 7,
    consentPurpose: 'core',
    maxPerWeek: 14,
    template: (p) => ({ title: `وقت ${p?.meal ?? 'غذا'}`, body: `هنوز ${p?.meal ?? 'وعده'} امروز رو انتخاب نکردی — یه پیشنهاد ببین.` }),
  },
  {
    key: 'weekly_plan_gap',
    description: "The week's meal plan has gaps.",
    priority: 5,
    consentPurpose: 'core',
    maxPerWeek: 2,
    template: () => ({ title: 'برنامهٔ هفته', body: 'چند وعدهٔ این هفته خالیه — چند دقیقه برنامه بریز.' }),
  },
  {
    key: 'saved_not_cooked',
    description: 'A recipe was saved but never cooked.',
    priority: 4,
    consentPurpose: 'personalization',
    maxPerWeek: 2,
    template: (p) => ({ title: 'یادته ذخیره کردی؟', body: `«${p?.title ?? 'یه رسپی'}» رو ذخیره کردی ولی هنوز نپختی.` }),
  },
  {
    key: 'discovery_similar',
    description: 'Discovery: similar to what the user recently cooked.',
    priority: 3,
    consentPurpose: 'personalization',
    maxPerWeek: 2,
    template: (p) => ({ title: 'شاید خوشت بیاد', body: `شبیه چیزی که اخیراً پختی: «${p?.title ?? 'یه پیشنهاد'}».` }),
  },
  {
    key: 'churn_reengagement',
    description: 'Re-engagement after a period of inactivity.',
    priority: 5,
    consentPurpose: 'personalization',
    maxPerWeek: 1,
    template: () => ({ title: 'دلتنگت شدیم!', body: 'مدتیه سر نزدی — بیا یه غذای خوشمزه با هم بپزیم.' }),
  },
  // GAMIFY-L4-11 — gamification feeds the INE as TRIGGERS (no parallel notifier). Kind, non-shaming copy.
  {
    key: 'streak_at_risk',
    description: 'A private cooking streak is at risk this week (kind nudge, no pressure).',
    priority: 4,
    consentPurpose: 'personalization',
    maxPerWeek: 1,
    template: (p) => ({ title: 'رشتهٔ آشپزی‌ت', body: p?.message ?? 'یه آشپزی کوچیک این هفته، رشتهٔ آشپزی‌ت رو نگه می‌داره 🙂' }),
  },
  {
    key: 'achievement_unlocked',
    description: 'The user earned a new achievement (celebratory).',
    priority: 5,
    consentPurpose: 'personalization',
    maxPerWeek: 5,
    template: (p) => ({ title: 'دستاورد تازه! 🎉', body: p?.title ? `«${p.title}» رو باز کردی.` : 'یه دستاورد تازه باز کردی.' }),
  },
] as const;

const BY_KEY = new Map(NOTIFICATION_TRIGGERS.map((t) => [t.key, t]));
export const getTrigger = (key: string): NotificationTrigger | undefined => BY_KEY.get(key);
export const TRIGGER_KEYS: readonly string[] = NOTIFICATION_TRIGGERS.map((t) => t.key);

// content must never carry a medical/diagnostic claim
const FORBIDDEN = [/\bmedical\b/i, /\bdiagnos/i, /\bcure[sd]?\b/i, /\btreat(s|ment)?\b/i, /\bdisease\b/i, /درمان/, /تشخیص/, /بیماری/];

export function checkTriggerRegistry(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const keys = new Set<string>();
  const VALID_CONSENT = new Set(['core', 'analytics', 'personalization']);
  for (const t of NOTIFICATION_TRIGGERS) {
    if (keys.has(t.key)) issues.push(`duplicate trigger key: ${t.key}`);
    keys.add(t.key);
    if (!VALID_CONSENT.has(t.consentPurpose)) issues.push(`bad consentPurpose on ${t.key}`);
    if (t.priority < 1 || t.priority > 10) issues.push(`priority out of range on ${t.key}`);
    if (t.maxPerWeek < 1) issues.push(`maxPerWeek < 1 on ${t.key}`);
    const c = t.template({ count: 1, meal: 'ناهار', title: 'x' });
    const text = `${c.title} ${c.body}`;
    if (FORBIDDEN.some((re) => re.test(text))) issues.push(`forbidden medical term in ${t.key} template`);
    if (!c.title.trim() || !c.body.trim()) issues.push(`empty template on ${t.key}`);
  }
  return { ok: issues.length === 0, issues };
}
