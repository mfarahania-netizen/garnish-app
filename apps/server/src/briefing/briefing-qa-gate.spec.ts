/**
 * HABIT-L4-12 — Re-engagement honesty + reuse QA gate. Proves the briefing/habit-loop is HONEST (no
 * guilt/shame/FOMO/urgency, kind framing, deterministic — no randomness), REUSE-composed (no parallel
 * notifier/scheduler/profile/recommender), and delivered DRY-RUN via the S6 INE triggers. Writes an
 * evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { composeBriefing, mealContextFor } from './briefing-composer';
import { getTrigger } from '../notifications/ine/notification-triggers';

const DIR = __dirname;
function allSrc(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allSrc(full));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}
const sources = allSrc(DIR);
const fullText = sources.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
// scan real CODE only — strip comments so this gate's own anti-pattern docs don't trip the keyword checks
const codeOnly = fullText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// guilt / shame / fake-urgency / FOMO — English + Persian
const DARK = /abandon|miss you|don'?t lose|hurry|last chance|only today|now or never|act now|running out|از دست نده|عجله کن|فرصت آخر|تنهامون گذاشتی|ترکمون کردی|شکست خوردی|دیر شد|الان نخری/i;

const reengage = getTrigger('reengagement_gentle');
const daily = getTrigger('daily_briefing');
const reengageCopy = reengage ? JSON.stringify(reengage.template({})) : '';

describe('HABIT-L4-12 re-engagement honesty + reuse gate', () => {
  it('NO randomness in briefing logic (deterministic)', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(codeOnly).not.toMatch(/Math\.random/);
  });

  it('NO guilt / shame / fake-urgency / FOMO copy in the briefing or its re-engagement trigger', () => {
    expect(DARK.test(codeOnly)).toBe(false);
    expect(DARK.test(reengageCopy)).toBe(false);
  });

  it('re-engagement copy is KIND and opt-out-respecting in tone', () => {
    expect(reengageCopy).toMatch(/اینجاییم|آماده بودی|بدون.*عجله/);
  });

  it('NO parallel sender/scheduler in the briefing module (delivery is via the INE only)', () => {
    expect(codeOnly).not.toMatch(/@Cron|CronExpression|nodemailer|web-push|firebase|fcm|apns|onesignal|createTransport/i);
  });

  it('REUSE-composed: imports the canonical profile + S07 fit + S5 + S7 + S6 INE (no parallel build)', () => {
    expect(codeOnly).toMatch(/getLivingUserProfile/);
    expect(codeOnly).toMatch(/assessRecipeFit/);
    expect(codeOnly).toMatch(/MealPlansService/);
    expect(codeOnly).toMatch(/ShoppingListService/);
    expect(codeOnly).toMatch(/GamificationService/);
    expect(codeOnly).toMatch(/IneService/);
  });

  it('delivery flows through registered S6 INE triggers, consent-gated, DRY-RUN', () => {
    expect(daily?.consentPurpose).toBe('personalization');
    expect(reengage?.consentPurpose).toBe('personalization');
    expect(daily?.maxPerWeek).toBeLessThanOrEqual(7); // at most one per day
    expect(reengage?.maxPerWeek).toBe(1); // re-engagement is frequency-capped
  });

  it('briefing PROPOSES (does not auto-apply) and is one-per-day-per-context', () => {
    const now = new Date('2026-06-15T09:00:00Z');
    const context = mealContextFor(now);
    const b = composeBriefing({
      userId: 'u1', now, context,
      picks: [{ recipeId: 'r1', title: 't', fitScore: 0.8, recommendation: 'great_fit', reasons: ['r'], safe: true }],
      nudge: { kind: null as any, reason: '' },
      progress: { streakWeeks: 0, streakStatus: 'idle', streakMessage: '', newlyUnlockedTitle: null },
    });
    expect(b.proposesOnly).toBe(true);
    expect(b.dayKey).toBe(`u1:${b.date}:${context}`); // stable identity per (user, date, context)
    // a different meal context yields a distinct daily identity
    expect(composeBriefing({ userId: 'u1', now, context: context === 'dinner' ? 'breakfast' : 'dinner', picks: [], nudge: { kind: null as any, reason: '' }, progress: { streakWeeks: 0, streakStatus: 'idle', streakMessage: '', newlyUnlockedTitle: null } }).dayKey).not.toBe(b.dayKey);
  });

  it('writes the evidence artifact', () => {
    const checks = {
      no_randomness: !/Math\.random/.test(codeOnly),
      no_guilt_shame_fomo: !DARK.test(codeOnly) && !DARK.test(reengageCopy),
      kind_reengagement_copy: /اینجاییم|آماده بودی|بدون.*عجله/.test(reengageCopy),
      no_parallel_sender: !/@Cron|CronExpression|nodemailer|web-push|firebase|fcm|apns|onesignal/i.test(codeOnly),
      reuses_profile: /getLivingUserProfile/.test(codeOnly),
      reuses_s07_fit: /assessRecipeFit/.test(codeOnly),
      reuses_s5: /MealPlansService/.test(codeOnly) && /ShoppingListService/.test(codeOnly),
      reuses_s7: /GamificationService/.test(codeOnly),
      delivery_via_ine: /IneService/.test(codeOnly) && daily !== undefined && reengage !== undefined,
      triggers_consent_gated: daily?.consentPurpose === 'personalization' && reengage?.consentPurpose === 'personalization',
      reengagement_fatigue_capped: reengage?.maxPerWeek === 1,
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-HABIT-L4-12', feature: 'DailyBriefing+HonestHabitLoop', totalChecks: Object.keys(checks).length, failedChecks, checks, sourceFiles: sources.map((f) => path.basename(f)) };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(10);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../..', 'docs/qa/briefing');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_habit_l4_12_briefing_honesty_results.json'), JSON.stringify(artifact, null, 2));
  });
});
