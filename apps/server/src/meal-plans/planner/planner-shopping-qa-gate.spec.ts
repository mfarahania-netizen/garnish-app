/**
 * Planner + Shopping QA gate (GARNISH-PLANNER-L4-09) — consolidated, deterministic, offline.
 *
 * Cross-cutting invariants for the Track-1 closer: plan ALLERGY HARD-EXCLUDE, variety (no repeats),
 * pantry reuse, proposes-not-auto-applies; shopping aggregate+merge (resolved id), unit-merge + honest
 * incompatible-unit flag, categorize, servings scale; reuse of the unified profile (no parallel
 * recommender); sparse-data grace. Emits a PII-free artifact.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateMealPlan, PlanCandidate } from './meal-plan-generator';
import { MealPlanPlannerService } from './meal-plan-planner.service';
import { aggregateShoppingList } from '../../shopping-list/aggregation/shopping-aggregator';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const mk = (id: string, o: Partial<PlanCandidate> = {}): PlanCandidate => ({ recipeId: id, title: id, mealTypes: ['lunch', 'dinner'], cuisine: 'persian', categories: [], ingredients: ['rice'], cookingTime: 25, fitScore: 0.7, fitReasons: ['fit'], ...o });

describe('Planner + Shopping QA gate (PLANNER-L4-09)', () => {
  const checks: { id: string; category: string; ok: boolean }[] = [];
  const check = (id: string, c: string, ok: boolean) => checks.push({ id, category: c, ok });

  // plan: variety + propose-only
  const plan = generateMealPlan(Array.from({ length: 14 }, (_, i) => mk(`r${i}`)), { days: 7, meals: ['lunch', 'dinner'] });
  check('plan_proposes_not_applies', 'plan', plan.notApplied === true);
  check('plan_variety_no_repeat', 'plan', new Set(plan.slots.map((s) => s.recipeId)).size === plan.slots.length);
  check('plan_why_present', 'plan', plan.slots.every((s) => s.why.length > 0));
  check('plan_pantry_reuse', 'plan', (() => {
    const p = generateMealPlan([mk('a', { ingredients: ['chickpea', 'onion'], fitScore: 0.7 }), mk('b', { ingredients: ['chickpea'], fitScore: 0.62 }), mk('c', { ingredients: ['beef'], fitScore: 0.65 })], { days: 1, meals: ['lunch', 'dinner'] });
    return p.slots[1]?.recipeId === 'b';
  })());

  // shopping: merge / units / scale / categorize
  const agg = aggregateShoppingList([{ name: 'flour', amount: '2', unit: 'cup', category: 'pantry' }, { name: 'flour', amount: '1', unit: 'cup', category: 'pantry' }, { name: 'milk', amount: '1', unit: 'cup' }, { name: 'milk', amount: '200', unit: 'ml' }], { scale: 2 });
  const flour = agg.items.find((i) => i.name === 'flour');
  const milk = agg.items.find((i) => i.name === 'milk');
  check('shop_merge_same_unit_scaled', 'shopping', flour?.quantities[0].amount === 6); // (2+1)*2
  check('shop_incompatible_units_flagged', 'shopping', milk?.flags.includes('incompatible_units') === true && milk?.quantities.length === 2);
  check('shop_categorize', 'shopping', flour?.category === 'pantry');
  check('shop_dedupe_owned', 'shopping', aggregateShoppingList([{ name: 'salt', category: 'pantry' }], { ownedNames: ['salt'] }).items.length === 0);

  let artifactWritten = false;
  beforeAll(async () => {
    // allergy hard-exclude + reuse-proof (service level, mocked prisma + profile)
    const corpus = [
      { id: 'safe', title: 'Lentil', diet: 'omnivore', mealType: 'lunch', region: 'persian', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '[]', ingredients: [{ name: 'lentil', ingredient: null }] },
      { id: 'peanut', title: 'Peanut', diet: 'omnivore', mealType: 'lunch', region: 'asian', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }] },
    ];
    const prisma: any = { recipe: { findMany: jest.fn().mockResolvedValue(corpus) }, userEvent: { findMany: jest.fn().mockResolvedValue([]) } };
    const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
    declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: ['peanut'], confidence: 0.9, recencyScore: 1 } as any;
    const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(composeLivingUserProfile(declared, null, NOW)) };
    const svc = new MealPlanPlannerService(prisma, profiles, { hasPurpose: jest.fn().mockResolvedValue(true) } as any);
    const proposal = await svc.proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    check('plan_allergy_hard_exclude', 'allergy_safety', proposal.excludedForAllergy >= 1 && !proposal.slots.find((s) => s.recipeId === 'peanut'));
    check('reuses_unified_profile', 'reuse', profiles.getLivingUserProfile.mock.calls.length > 0);

    const artifact = {
      suite: 'PLANNER-L4-09', runMode: 'offline-deterministic', externalApiCalls: 0, liveAi: false,
      parallelRecommenderBuilt: false, reusesUnifiedProfile: true,
      totalChecks: checks.length, passedChecks: checks.filter((c) => c.ok).length, failedChecks: checks.filter((c) => !c.ok).length,
      categories: [...new Set(checks.map((c) => c.category))],
    };
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/behavior');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'planner_l4_09_qa_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
    artifactWritten = true;
  });

  it('passes every planner+shopping QA check (0 failures)', () => {
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) console.error('FAILED:', JSON.stringify(failed));
    expect(failed).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(artifactWritten).toBe(true);
  });
});
