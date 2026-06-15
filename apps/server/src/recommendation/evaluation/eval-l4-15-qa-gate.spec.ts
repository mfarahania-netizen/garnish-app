/**
 * GARNISH-EVAL-L4-15 QA gate — offline recsys eval, deterministic + honest, mandatory allergy guard, no shadow.
 *
 * Proves: offline metrics are deterministic (no Math.random) and computed from catalog + S9 representation +
 * fixtures; the allergy-safety metric is a HARD guard (leak → fail) that DETECTS a leak; behavior metrics are
 * honest null/"awaiting pilot" on empty data; and the new files never import the frozen runtime-shadow.
 * Writes an evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runRecommendationEval } from './recommendation-eval.harness';
import { allergenLeaks } from './offline-metrics';

const DIR = __dirname; // apps/server/src/recommendation/evaluation
const FILES = {
  metrics: path.join(DIR, 'offline-metrics.ts'),
  harness: path.join(DIR, 'recommendation-eval.harness.ts'),
  service: path.join(DIR, 'recommendation-eval.service.ts'),
};
const read = (p: string) => fs.readFileSync(p, 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const code = Object.values(FILES).map((f) => stripComments(read(f))).join('\n');
const IMPORTS_SHADOW = /from\s+['"][^'"]*runtime-shadow/;

const ing = (name: string, allergens: string[] = []) => ({ name, ingredient: allergens.length ? { allergens: { eu14: allergens, us9: allergens, other: [], mayContain: [] } } : null });
const CATALOG = [
  { id: 'a', title: 'Chicken Pilaf', diet: 'omnivore', difficulty: 'easy', cookingTime: 40, allergens: '[]', categories: '[]', region: 'persian', ingredients: [ing('chicken')] },
  { id: 'b', title: 'Lentil Soup', diet: 'vegan', difficulty: 'easy', cookingTime: 30, allergens: '[]', categories: '[]', region: 'intl', ingredients: [ing('lentil')] },
  { id: 'c', title: 'Peanut Noodles', diet: 'omnivore', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', categories: '[]', region: 'asian', ingredients: [ing('peanut', ['peanut'])] },
];
const NOW = new Date('2026-06-15T12:00:00Z');

describe('EVAL-L4-15 QA gate', () => {
  it('NO second shadow: eval files never import runtime-shadow', () => {
    for (const p of Object.values(FILES)) expect(read(p)).not.toMatch(IMPORTS_SHADOW);
  });

  it('DETERMINISTIC: no Math.random in offline metrics / harness / service', () => {
    expect(code).not.toMatch(/Math\.random/);
    expect(JSON.stringify(runRecommendationEval({ catalog: CATALOG, now: NOW }))).toBe(JSON.stringify(runRecommendationEval({ catalog: CATALOG, now: NOW })));
  });

  it('offline metrics give numbers NOW (coverage/diversity/fit-quality) over the catalog', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW });
    expect(typeof r.offline.catalogCoverage.value).toBe('number');
    expect(typeof r.offline.diversity.value).toBe('number');
    expect(r.offline.fitQuality.value!).toBeGreaterThan(0);
  });

  it('ALLERGY-SAFETY is a HARD guard (passes clean, DETECTS a leak)', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW });
    expect(r.allergySafety.pass).toBe(true);
    expect(r.allergySafety.leaks).toBe(0);
    // a leak is detectable → a regression would fail the harness
    expect(allergenLeaks([{ recipe: CATALOG[2] }], ['peanut'])).toBeGreaterThan(0);
  });

  it('online + popularity metrics are HONEST null/"awaiting pilot" on empty data (not faked)', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW, online: { impressions: 0 } });
    expect(r.online.clickThroughRate.value).toBeNull();
    expect(r.offline.popularityBias.value).toBeNull();
  });

  it('writes the evidence artifact', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW, online: { impressions: 0 } });
    const checks = {
      no_runtime_shadow_import: Object.values(FILES).every((p) => !IMPORTS_SHADOW.test(read(p))),
      deterministic_no_random: !/Math\.random/.test(code),
      offline_numbers_now: typeof r.offline.catalogCoverage.value === 'number' && typeof r.offline.diversity.value === 'number' && (r.offline.fitQuality.value ?? 0) > 0,
      allergy_guard_passes: r.allergySafety.pass === true && r.allergySafety.leaks === 0,
      allergy_guard_detects_leak: allergenLeaks([{ recipe: CATALOG[2] }], ['peanut']) > 0,
      online_honest_null: r.online.clickThroughRate.value === null && r.online.clickThroughRate.awaitingPilot === true,
      popularity_honest_null: r.offline.popularityBias.value === null,
      reuses_s9_representation: /recipe-content/.test(read(FILES.metrics)),
      reuses_assess_recipe_fit: /assessRecipeFit/.test(read(FILES.metrics)),
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-EVAL-L4-15', layer: 'offline recsys eval harness + metrics', totalChecks: Object.keys(checks).length, failedChecks, checks, report: r };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(9);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_eval_l4_15_offline_recsys_results.json'), JSON.stringify(artifact, null, 2));
  });
});
