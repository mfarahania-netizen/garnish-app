/**
 * GAMIFY-L4-11 — Achievement catalog + evaluation (pure, deterministic, idempotent).
 *
 * HONEST design: every achievement maps to REAL, earned cooking progress (deterministic threshold on
 * server-derived stats — NO randomness, no variable-ratio/casino loops, no grindy filler). Copy is kind
 * and celebratory, never about weight/calories/medical claims. Idempotent: already-unlocked are never
 * re-awarded (no double-award).
 */

export interface CookStats {
  totalCooks: number;
  distinctRecipes: number;
  distinctCuisines: number;
  hardRecipesCooked: number;
  fullWeeksPlanned: number;
  favoritesCount: number;
  currentStreakWeeks: number;
}

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  /** deterministic, derived from real server-side stats only */
  criteria: (s: CookStats) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { key: 'first_cook', title: 'اولین آشپزی', description: 'اولین غذات رو پختی — شروع عالی!', criteria: (s) => s.totalCooks >= 1 },
  { key: 'cook_5', title: '۵ آشپزی', description: '۵ بار آشپزی کردی.', criteria: (s) => s.totalCooks >= 5 },
  { key: 'cook_25', title: 'آشپز پرکار', description: '۲۵ بار آشپزی کردی.', criteria: (s) => s.totalCooks >= 25 },
  { key: 'recipe_variety_10', title: 'تنوع‌دوست', description: '۱۰ رسپی متفاوت رو امتحان کردی.', criteria: (s) => s.distinctRecipes >= 10 },
  { key: 'cuisine_explorer', title: 'کاشف آشپزی‌ها', description: 'از ۳ آشپزی متفاوت غذا پختی.', criteria: (s) => s.distinctCuisines >= 3 },
  { key: 'brave_cook', title: 'دل به دریا', description: 'یه رسپی چالشی رو پختی.', criteria: (s) => s.hardRecipesCooked >= 1 },
  { key: 'week_planner', title: 'برنامه‌ریز هفته', description: 'یه هفتهٔ کامل غذایی برنامه‌ریزی کردی.', criteria: (s) => s.fullWeeksPlanned >= 1 },
  { key: 'consistency_4w', title: 'پایدار و منظم', description: '۴ هفتهٔ پیاپی آشپزی کردی.', criteria: (s) => s.currentStreakWeeks >= 4 },
  { key: 'collector_10', title: 'گردآورنده', description: '۱۰ رسپی رو ذخیره کردی.', criteria: (s) => s.favoritesCount >= 10 },
] as const;

export const ACHIEVEMENT_KEYS: readonly string[] = ACHIEVEMENTS.map((a) => a.key);
const BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));
export const getAchievement = (key: string): AchievementDef | undefined => BY_KEY.get(key);

export interface AchievementEvaluation {
  newlyUnlocked: AchievementDef[];
  allEarned: string[];
}

/** Earned achievements given stats, minus those already unlocked (idempotent — no double-award). */
export function evaluateAchievements(stats: CookStats, alreadyUnlocked: string[] = []): AchievementEvaluation {
  const already = new Set(alreadyUnlocked);
  const earned = ACHIEVEMENTS.filter((a) => a.criteria(stats));
  const newlyUnlocked = earned.filter((a) => !already.has(a.key));
  const allEarned = [...new Set([...alreadyUnlocked, ...earned.map((a) => a.key)])];
  return { newlyUnlocked, allEarned };
}

// content must never carry weight-loss / calorie / medical framing — this is cooking progress, not fitness
const FORBIDDEN = [/calorie/i, /weight\s*loss/i, /\bdiet\b/i, /\bmedical\b/i, /diagnos/i, /کالری/, /لاغر/, /چاق/, /رژیم/, /درمان/, /بیماری/];

export function checkAchievementCatalog(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const a of ACHIEVEMENTS) {
    if (keys.has(a.key)) issues.push(`duplicate achievement key: ${a.key}`);
    keys.add(a.key);
    const text = `${a.title} ${a.description}`;
    if (FORBIDDEN.some((re) => re.test(text))) issues.push(`forbidden fitness/medical framing in ${a.key}`);
    if (!a.title.trim() || !a.description.trim()) issues.push(`empty copy on ${a.key}`);
  }
  return { ok: issues.length === 0, issues };
}
