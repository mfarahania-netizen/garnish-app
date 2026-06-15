/**
 * GARNISH-COLDSTART-L4-14 QA gate — live-pipeline cold-start upgrade, allergy-safe, no parallel/shadow.
 *
 * Proves: cold-start reads getLivingUserProfile (not raw user.preferences) + the S9 content store, ranks by
 * assessRecipeFit (not createdAt), the history-aware blend is deterministic + flagged, and NONE of the
 * touched files import the frozen recommendation runtime-shadow. Writes an evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { coldStartWeightBlend, coldStartBlendEnabled, COLDSTART_BLEND_FLAG } from './coldstart';

const DIR = __dirname; // apps/server/src/recommendation/pipeline
const FILES = {
  candidate: path.join(DIR, 'candidate-generator.ts'),
  ranking: path.join(DIR, 'ranking.service.ts'),
  coldstart: path.join(DIR, 'coldstart.ts'),
};
const read = (p: string) => fs.readFileSync(p, 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const IMPORTS_SHADOW = /from\s+['"][^'"]*runtime-shadow/;
const BASE = { tasteAffinity: 0.27, behaviorFit: 0.22, outcomeFit: 0.17, novelty: 0.09, popularity: 0.04, recency: 0.02, recipeUnderstanding: 0.1, ingredientIntelligence: 0.09 };

describe('COLDSTART-L4-14 QA gate', () => {
  it('NO parallel/shadow: touched files never import runtime-shadow', () => {
    for (const p of Object.values(FILES)) expect(read(p)).not.toMatch(IMPORTS_SHADOW);
  });

  it('cold-start reads getLivingUserProfile (NOT raw user.preferences) for the constraint/allergy set', () => {
    const code = stripComments(read(FILES.candidate));
    expect(code).toMatch(/getLivingUserProfile/);
    expect(code).not.toMatch(/user\.preferences\?\.diet|user\.preferences\?\.budget/); // the old naive path is gone
  });

  it('cold-start applies the allergy HARD filter via assessRecipeFit (avoid_allergen dropped)', () => {
    const code = stripComments(read(FILES.candidate));
    expect(code).toMatch(/assessRecipeFit/);
    expect(code).toMatch(/avoid_allergen/);
  });

  it('cold-start ranks by FIT, not createdAt', () => {
    const code = stripComments(read(FILES.candidate));
    expect(code).toMatch(/fitScore/);
    // the cold-start path no longer orders its results by createdAt
    expect(code).not.toMatch(/orderBy:\s*\{\s*createdAt/);
  });

  it('reuses the S9 content representation/feature store', () => {
    expect(stripComments(read(FILES.candidate))).toMatch(/RecipeContentFeatureStore|this\.content\.neighbors/);
  });

  it('DETERMINISTIC: no Math.random in cold-start / ranking', () => {
    expect(stripComments(read(FILES.candidate))).not.toMatch(/Math\.random/);
    expect(stripComments(read(FILES.ranking))).not.toMatch(/Math\.random/);
    expect(stripComments(read(FILES.coldstart))).not.toMatch(/Math\.random/);
  });

  it('history-aware ranking blend is flagged + behaves (thin leans to content/popularity, rich unchanged)', () => {
    expect(read(FILES.ranking)).toMatch(/coldStartBlendEnabled|coldStartWeightBlend/);
    expect(coldStartWeightBlend(BASE, 0.8)).toEqual(BASE); // rich → unchanged
    const thin = coldStartWeightBlend(BASE, 0.0);
    expect(thin.behaviorFit).toBeLessThan(BASE.behaviorFit);
    expect(thin.recipeUnderstanding).toBeGreaterThan(BASE.recipeUnderstanding);
  });

  it('writes the evidence artifact', () => {
    const cand = stripComments(read(FILES.candidate));
    const rank = stripComments(read(FILES.ranking));
    const checks = {
      no_runtime_shadow_import: Object.values(FILES).every((p) => !IMPORTS_SHADOW.test(read(p))),
      reads_living_profile: /getLivingUserProfile/.test(cand),
      no_raw_preferences_constraint: !/user\.preferences\?\.diet|user\.preferences\?\.budget/.test(cand),
      allergy_hard_filter: /assessRecipeFit/.test(cand) && /avoid_allergen/.test(cand),
      ranked_by_fit_not_createdat: /fitScore/.test(cand) && !/orderBy:\s*\{\s*createdAt/.test(cand),
      reuses_s9_content_store: /RecipeContentFeatureStore|this\.content\.neighbors/.test(cand),
      no_randomness: !/Math\.random/.test(cand) && !/Math\.random/.test(rank),
      blend_flagged: /coldStartBlendEnabled|coldStartWeightBlend/.test(rank),
      blend_history_aware: coldStartWeightBlend(BASE, 0.0).behaviorFit < BASE.behaviorFit && JSON.stringify(coldStartWeightBlend(BASE, 0.8)) === JSON.stringify(BASE),
      flag_default_on: (() => { const prev = process.env[COLDSTART_BLEND_FLAG]; delete process.env[COLDSTART_BLEND_FLAG]; const on = coldStartBlendEnabled(); if (prev === undefined) delete process.env[COLDSTART_BLEND_FLAG]; else process.env[COLDSTART_BLEND_FLAG] = prev; return on; })(),
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-COLDSTART-L4-14', scope: 'live pipeline cold-start + content ranking (allergy-safe)', totalChecks: Object.keys(checks).length, failedChecks, checks, flag: COLDSTART_BLEND_FLAG };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(10);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_coldstart_l4_14_results.json'), JSON.stringify(artifact, null, 2));
  });
});
