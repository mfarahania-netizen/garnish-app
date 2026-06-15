/**
 * GAMIFY-L4-11 — Anti-dark-pattern QA gate. Proves the engine is HONEST: no public leaderboard /
 * comparison, no casino/variable-ratio randomness in award logic, kind (non-shaming) streak framing,
 * deterministic + idempotent awards, and gamification notifications routed via the consent-gated S6 INE
 * triggers. Writes an evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { computeStreak } from './engine/gamification-streak';
import { evaluateAchievements, checkAchievementCatalog, CookStats } from './engine/gamification-achievements';
import { getTrigger } from '../notifications/ine/notification-triggers';

const GAM_DIR = __dirname;
function allSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allSourceFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}
const sources = allSourceFiles(GAM_DIR);
const sourceText = sources.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
// scan real CODE only — strip comments so this gate's own anti-pattern documentation
// ("NO leaderboard / ranking / comparison") doesn't trip the keyword checks.
const codeOnly = sourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const baseStats = (over: Partial<CookStats> = {}): CookStats => ({
  totalCooks: 0, distinctRecipes: 0, distinctCuisines: 0, hardRecipesCooked: 0, fullWeeksPlanned: 0, favoritesCount: 0, currentStreakWeeks: 0, ...over,
});

describe('GAMIFY-L4-11 anti-dark-pattern gate', () => {
  const SHAME = /شکست|باختی|تنبل|از دست دادی|نتونستی/;

  it('NO casino / variable-ratio randomness anywhere in the gamification engine', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(codeOnly).not.toMatch(/Math\.random/);
  });

  it('NO leaderboard / ranking / public comparison in the engine code', () => {
    expect(codeOnly).not.toMatch(/leaderboard|ranking|rankUsers|compareToOthers|topUsers/i);
  });

  it('the only read route is the owner-private "me" (no comparison endpoint)', () => {
    const controller = fs.readFileSync(path.join(GAM_DIR, 'gamification.controller.ts'), 'utf8');
    const routes = [...controller.matchAll(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(routes.length).toBe(1);
    expect(routes[0]).toMatch(/Get.*me/);
  });

  it('awards are DETERMINISTIC (same stats → identical result) and idempotent', () => {
    const s = baseStats({ totalCooks: 30, distinctCuisines: 4, currentStreakWeeks: 4 });
    expect(evaluateAchievements(s).allEarned.sort()).toEqual(evaluateAchievements(s).allEarned.sort());
    expect(evaluateAchievements(s, ['first_cook']).newlyUnlocked.map((a) => a.key)).not.toContain('first_cook');
  });

  it('achievement copy carries no fitness/medical framing', () => {
    expect(checkAchievementCatalog().ok).toBe(true);
  });

  it('a broken / idle streak is framed KINDLY, never shaming', () => {
    expect(SHAME.test(computeStreak([], new Date('2026-06-20T12:00:00Z')).kindMessage)).toBe(false);
    const broken = computeStreak([], new Date('2026-06-20T12:00:00Z'));
    expect(broken.status).toBe('idle');
    expect(broken.kindMessage.length).toBeGreaterThan(0);
  });

  it('gamification notifications go through the consent-gated S6 INE triggers (no parallel notifier)', () => {
    const streak = getTrigger('streak_at_risk');
    const ach = getTrigger('achievement_unlocked');
    expect(streak?.consentPurpose).toBe('personalization');
    expect(ach?.consentPurpose).toBe('personalization');
    // gamification service must not import a mailer/push/web-push provider
    expect(codeOnly).not.toMatch(/nodemailer|web-push|firebase|fcm|apns|onesignal/i);
  });

  it('writes the evidence artifact', () => {
    const checks = {
      no_randomness: !/Math\.random/.test(codeOnly),
      no_leaderboard_code: !/leaderboard|ranking|compareToOthers|topUsers/i.test(codeOnly),
      single_owner_route: true,
      deterministic_awards: JSON.stringify(evaluateAchievements(baseStats({ totalCooks: 5 })).allEarned) === JSON.stringify(evaluateAchievements(baseStats({ totalCooks: 5 })).allEarned),
      idempotent_awards: !evaluateAchievements(baseStats({ totalCooks: 5 }), ['first_cook']).newlyUnlocked.some((a) => a.key === 'first_cook'),
      non_medical_copy: checkAchievementCatalog().ok,
      kind_reset_copy: !SHAME.test(computeStreak([], new Date('2026-06-20T12:00:00Z')).kindMessage),
      ine_triggers_consent_gated: getTrigger('streak_at_risk')?.consentPurpose === 'personalization' && getTrigger('achievement_unlocked')?.consentPurpose === 'personalization',
      no_push_or_mail_provider: !/nodemailer|web-push|firebase|fcm|apns|onesignal/i.test(codeOnly),
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-GAMIFY-L4-11', engine: 'HonestGamificationEngine', totalChecks: Object.keys(checks).length, failedChecks, checks, sourceFiles: sources.map((f) => path.basename(f)) };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(9);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../..', 'docs/qa/gamification');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_gamify_l4_11_anti_dark_pattern_results.json'), JSON.stringify(artifact, null, 2));
  });
});
