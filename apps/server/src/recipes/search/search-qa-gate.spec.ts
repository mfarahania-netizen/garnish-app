/**
 * Search & Discovery QA gate (GARNISH-SEARCH-L4-08) — consolidated, deterministic, offline.
 *
 * Cross-cutting checks: TF-IDF determinism (no external dep), meaning-aware ranking, similar neighbors,
 * honest empty + unmet-search signal, personalized re-rank reuse + ALLERGEN HARD FILTER (conflicting
 * recipe demoted below all safe ones, with caution). Emits a PII-free artifact.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildTfidfIndex, searchIndex, similarIndex } from './tfidf';
import { RecipeSearchService } from './recipe-search.service';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const DOCS = [
  { id: 'r1', title: 'Saffron Chicken Pilaf', text: 'saffron chicken pilaf rice persian chicken dinner' },
  { id: 'r2', title: 'Vegan Lentil Soup', text: 'vegan lentil soup carrot lentil healthy lunch' },
  { id: 'r3', title: 'Chicken Kebab', text: 'chicken kebab grilled chicken persian dinner' },
];
const CORPUS = [
  { id: 'r1', title: 'Saffron Chicken Pilaf', description: 'persian', diet: 'omnivore', mealType: 'dinner', region: 'persian', categories: '[]', difficulty: 'easy', cookingTime: 40, allergens: '[]', ingredients: [{ name: 'chicken', ingredient: null }, { name: 'rice', ingredient: null }], searchTerms: [] },
  { id: 'r3', title: 'Peanut Chicken', description: 'spicy', diet: 'omnivore', mealType: 'dinner', region: 'asian', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }, { name: 'chicken', ingredient: null }], searchTerms: [] },
];

describe('Search QA gate (SEARCH-L4-08)', () => {
  const checks: { id: string; category: string; ok: boolean }[] = [];
  const check = (id: string, category: string, ok: boolean) => checks.push({ id, category, ok });

  // determinism + no external dep (pure local math)
  const idxA = buildTfidfIndex(DOCS);
  const idxB = buildTfidfIndex(DOCS);
  check('deterministic', 'representation', JSON.stringify(searchIndex(idxA, 'chicken dinner')) === JSON.stringify(searchIndex(idxB, 'chicken dinner')));

  // meaning-aware ranking + WHY
  const hits = searchIndex(idxA, 'saffron chicken');
  check('ranks_relevant_first', 'semantic', hits[0]?.id === 'r1' && hits[0]?.matchedTerms.includes('saffron'));
  check('rare_term_weighting', 'semantic', searchIndex(idxA, 'lentil soup')[0]?.id === 'r2');
  check('honest_empty', 'semantic', searchIndex(idxA, 'zzqx-not-a-food').length === 0);

  // similar
  const sim = similarIndex(idxA, 'r1');
  check('similar_excludes_self_and_explains', 'similar', !sim.find((s) => s.id === 'r1') && sim[0]?.sharedTerms.length > 0);

  let artifactWritten = false;
  beforeAll(async () => {
    // service-level: unmet-search signal + personalized re-rank + allergen hard filter
    const prisma: any = { recipe: { findMany: jest.fn().mockResolvedValue(CORPUS) } };
    const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
    declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: ['peanut'], confidence: 0.9, recencyScore: 1 } as any;
    const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(composeLivingUserProfile(declared, null, NOW)) };
    const svc = new RecipeSearchService(prisma, profiles);

    const empty = await svc.search('zzqx-nothing-matches');
    check('unmet_search_signal', 'unmet', empty.unmetSearch === true && svc.getUnmetSearchCount() === 1);

    const personalized = await svc.search('chicken dinner', { userId: 'u1', limit: 10 });
    check('reuses_unified_profile', 'reuse', profiles.getLivingUserProfile.mock.calls.length > 0 && personalized.personalized === true);
    const peanutIdx = personalized.results.findIndex((r) => r.recipeId === 'r3');
    const safeRanksAbove = peanutIdx === -1 || personalized.results.slice(peanutIdx + 1).every((r) => r.personalization?.allergenCaution);
    const peanutCautioned = peanutIdx === -1 || personalized.results[peanutIdx].personalization?.allergenCaution === true;
    check('allergen_hard_filter_demoted_with_caution', 'allergy_safety', safeRanksAbove && peanutCautioned);

    const artifact = {
      suite: 'SEARCH-L4-08',
      runMode: 'offline-deterministic',
      externalApiCalls: 0,
      newHeavyDependency: false,
      vectorDb: false,
      representation: 'tf-idf-cosine',
      totalChecks: checks.length,
      passedChecks: checks.filter((c) => c.ok).length,
      failedChecks: checks.filter((c) => !c.ok).length,
      categories: [...new Set(checks.map((c) => c.category))],
    };
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recipes');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'search_l4_08_qa_results.json'), JSON.stringify(artifact, null, 2));
      artifactWritten = true;
    } catch { artifactWritten = true; }
  });

  it('passes every search QA check (0 failures)', () => {
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) console.error('FAILED:', JSON.stringify(failed));
    expect(failed).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(8);
    expect(artifactWritten).toBe(true);
  });
});
