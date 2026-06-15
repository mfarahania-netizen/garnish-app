import { runRecommendationEval } from './recommendation-eval.harness';
import { allergenLeaks, selectFitRankedSafe } from './offline-metrics';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

function peanutAllergicProfile(now: Date) {
  const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: now.toISOString() }], { granted: ['core', 'analytics', 'personalization'] }, { now });
  declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: ['peanut'], confidence: 0.9, recencyScore: 1 } as any;
  return composeLivingUserProfile(declared, null, now);
}

const NOW = new Date('2026-06-15T12:00:00.000Z');
const ing = (name: string, allergens: string[] = []) => ({ name, ingredient: allergens.length ? { allergens: { eu14: allergens, us9: allergens, other: [], mayContain: [] } } : null });

const CATALOG = [
  { id: 'chicken-pilaf', title: 'Saffron Chicken Pilaf', diet: 'omnivore', difficulty: 'easy', cookingTime: 40, allergens: '[]', categories: '["dinner"]', region: 'persian', ingredients: [ing('chicken'), ing('rice'), ing('saffron')] },
  { id: 'lentil-soup', title: 'Vegan Lentil Soup', diet: 'vegan', difficulty: 'easy', cookingTime: 30, allergens: '[]', categories: '["soup"]', region: 'international', ingredients: [ing('lentil'), ing('carrot')] },
  { id: 'quick-omelette', title: 'Quick Omelette', diet: 'omnivore', difficulty: 'easy', cookingTime: 15, allergens: '["egg"]', categories: '["breakfast"]', region: 'international', ingredients: [ing('egg', ['egg'])] },
  { id: 'peanut-noodles', title: 'Peanut Noodles', diet: 'omnivore', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', categories: '["noodles"]', region: 'asian', ingredients: [ing('peanut', ['peanut']), ing('noodles')] },
  { id: 'cheese-pasta', title: 'Creamy Cheese Pasta', diet: 'omnivore', difficulty: 'medium', cookingTime: 35, allergens: '["milk"]', categories: '["pasta"]', region: 'italian', ingredients: [ing('cheese', ['milk']), ing('pasta')] },
];

describe('GARNISH-EVAL-L4-15 — offline recsys eval harness', () => {
  it('runs over the catalog + fixtures and produces structural metric numbers NOW', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW });
    expect(r.suite).toBe('RECSYS-OFFLINE-L4-15');
    expect(r.catalogSize).toBe(5);
    expect(typeof r.offline.catalogCoverage.value).toBe('number');
    expect(typeof r.offline.diversity.value).toBe('number');
    expect(typeof r.offline.fitQuality.value).toBe('number');
    expect(r.offline.fitQuality.value!).toBeGreaterThan(0);
  });

  it('ALLERGY-SAFETY HARD GUARD: allergy fixtures yield ZERO allergen recommendations', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW });
    expect(r.allergySafety.fixturesChecked).toBeGreaterThanOrEqual(2); // peanut + dairy fixtures
    expect(r.allergySafety.leaks).toBe(0);
    expect(r.allergySafety.pass).toBe(true);
    expect(r.overallPass).toBe(true);
  });

  it('the guard DETECTS a leak (a regression would FAIL the harness)', () => {
    const peanut = CATALOG.find((c) => c.id === 'peanut-noodles');
    const safe = CATALOG.find((c) => c.id === 'lentil-soup');
    // independent allergen-intersection check flags a peanut recipe for a peanut-allergic user
    expect(allergenLeaks([{ recipe: peanut }], ['peanut'])).toBeGreaterThan(0);
    expect(allergenLeaks([{ recipe: safe }], ['peanut'])).toBe(0);
  });

  it('the recommender itself never selects the conflicting recipe (safe selection)', () => {
    // a peanut-allergic profile over a catalog whose only option is the peanut recipe → empty (never surfaced)
    const peanutProfileCatalog = [CATALOG.find((c) => c.id === 'peanut-noodles')];
    const recs = selectFitRankedSafe(peanutProfileCatalog as any[], peanutAllergicProfile(NOW), 10);
    expect(recs.map((x) => x.recipeId)).not.toContain('peanut-noodles');
  });

  it('DETERMINISTIC: identical input → identical report (no randomness, no faked numbers)', () => {
    const a = runRecommendationEval({ catalog: CATALOG, now: NOW });
    const b = runRecommendationEval({ catalog: CATALOG, now: NOW });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('online metrics + popularity-bias are HONEST null/"awaiting pilot" with no real data (NOT faked)', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW, online: { impressions: 0 } });
    expect(r.online.clickThroughRate.value).toBeNull();
    expect(r.online.clickThroughRate.awaitingPilot).toBe(true);
    expect(r.offline.popularityBias.value).toBeNull(); // no favorites/views supplied → awaiting
    expect(r.offline.popularityBias.awaitingPilot).toBe(true);
  });

  it('uses real online data when present (pilot)', () => {
    const r = runRecommendationEval({ catalog: CATALOG, now: NOW, online: { impressions: 100, clickThroughRate: 0.2 } });
    expect(r.online.clickThroughRate.value).toBe(0.2);
    expect(r.online.clickThroughRate.awaitingPilot).toBeUndefined();
  });
});
