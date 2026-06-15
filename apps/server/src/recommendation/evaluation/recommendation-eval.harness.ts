/**
 * GARNISH-EVAL-L4-15 — runnable OFFLINE recsys eval harness (mirrors ai-eval.harness).
 *
 * Runs the deterministic offline metrics over the catalog + declared-profile fixtures and emits a
 * structured report (per-metric value + threshold pass/fail + which metrics are "awaiting pilot"). The
 * allergy-safety metric is the mandatory HARD guard: any allergen leak across the allergy fixtures fails
 * the whole run. Behavior metrics (CTR/save/cook/retention) are reported as honest null/"awaiting pilot"
 * when there is no real data — never fabricated. Deterministic: identical input → identical report.
 */
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';
import { selectFitRankedSafe, catalogCoverage, intraListDiversity, avgFitQuality, popularityBias, allergenLeaks, ScoredRec } from './offline-metrics';

export interface EvalFixture {
  id: string;
  declared: { key: string; value: unknown }[];
  allergens: string[]; // declared allergies (for the independent allergy-safety check)
}

/** Default declared-profile fixtures: diet variety + the mandatory allergy fixtures. */
export function defaultFixtures(): EvalFixture[] {
  return [
    { id: 'omnivore', declared: [{ key: 'dietary.pattern', value: 'omnivore' }], allergens: [] },
    { id: 'vegan', declared: [{ key: 'dietary.pattern', value: 'vegan' }], allergens: [] },
    { id: 'beginner_quick', declared: [{ key: 'dietary.pattern', value: 'omnivore' }, { key: 'constraints.cooking_skill', value: 'beginner' }], allergens: [] },
    { id: 'peanut_allergic', declared: [{ key: 'dietary.pattern', value: 'omnivore' }], allergens: ['peanut'] },
    { id: 'dairy_allergic', declared: [{ key: 'dietary.pattern', value: 'omnivore' }], allergens: ['milk'] },
  ];
}

function buildProfile(f: EvalFixture, now: Date) {
  const declared = buildDeclaredProfile(f.id, f.declared.map((d) => ({ key: d.key, value: d.value, declaredAt: now.toISOString() })), { granted: ['core', 'analytics', 'personalization'] }, { now });
  if (f.allergens.length) {
    declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: f.allergens, confidence: 0.9, recencyScore: 1 } as any;
  }
  return composeLivingUserProfile(declared, null, now);
}

export interface MetricResult {
  value: number | null;
  threshold: number | null;
  pass: boolean;
  awaitingPilot?: boolean;
  note: string;
}

export interface OnlineMetrics {
  impressions?: number;
  clickThroughRate?: number;
  saveRate?: number;
  cookRate?: number;
}

export interface RecEvalReport {
  suite: 'RECSYS-OFFLINE-L4-15';
  catalogSize: number;
  fixtures: number;
  deterministic: true;
  offline: Record<string, MetricResult>;
  allergySafety: { fixturesChecked: number; leaks: number; pass: boolean; note: string };
  online: Record<string, MetricResult>;
  overallPass: boolean;
}

const THRESHOLDS = { catalogCoverage: 0.05, diversity: 0.05, fitQuality: 0.4, popularityBiasMax: 0.6 };

export function runRecommendationEval(input: {
  catalog: any[];
  now: Date;
  fixtures?: EvalFixture[];
  popularity?: Map<string, number>;
  online?: OnlineMetrics | null;
  limit?: number;
}): RecEvalReport {
  const fixtures = input.fixtures ?? defaultFixtures();
  const limit = input.limit ?? 10;
  const popularity = input.popularity ?? new Map<string, number>();

  const recByFixture = fixtures.map((f) => {
    const profile = buildProfile(f, input.now);
    const recs: ScoredRec[] = selectFitRankedSafe(input.catalog, profile, limit);
    return { fixture: f, recs };
  });

  const recListsIds = recByFixture.map((r) => r.recs.map((x) => x.recipeId));
  const recipeLists = recByFixture.map((r) => r.recs.map((x) => x.recipe));
  const scoredLists = recByFixture.map((r) => r.recs);

  // ── A. offline structural metrics (numbers NOW) ──
  const coverage = catalogCoverage(recListsIds, input.catalog.length);
  const diversity = intraListDiversity(recipeLists);
  const fitQuality = avgFitQuality(scoredLists);
  const popBias = popularityBias(recListsIds, popularity);

  const offline: Record<string, MetricResult> = {
    catalogCoverage: { value: coverage, threshold: THRESHOLDS.catalogCoverage, pass: coverage >= THRESHOLDS.catalogCoverage, note: 'fraction of catalog recommendable across fixtures' },
    diversity: { value: diversity, threshold: THRESHOLDS.diversity, pass: diversity >= THRESHOLDS.diversity, note: 'avg intra-list dissimilarity (S9 content vectors)' },
    fitQuality: { value: fitQuality, threshold: THRESHOLDS.fitQuality, pass: fitQuality >= THRESHOLDS.fitQuality, note: 'avg assessRecipeFit fitScore across recommended items' },
    popularityBias: popBias === null
      ? { value: null, threshold: THRESHOLDS.popularityBiasMax, pass: true, awaitingPilot: true, note: 'no popularity signal yet (favorites/views) — awaiting pilot' }
      : { value: popBias, threshold: THRESHOLDS.popularityBiasMax, pass: popBias <= THRESHOLDS.popularityBiasMax, note: 'share of recs from the top-popularity decile (lower = less popularity-biased)' },
  };

  // ── B. mandatory allergy-safety HARD guard (independent allergen-intersection check) ──
  const allergyFixtures = recByFixture.filter((r) => r.fixture.allergens.length > 0);
  let leaks = 0;
  for (const { fixture, recs } of allergyFixtures) leaks += allergenLeaks(recs, fixture.allergens);
  const allergySafety = { fixturesChecked: allergyFixtures.length, leaks, pass: leaks === 0, note: 'declared-allergy fixtures must yield ZERO allergen recommendations (cold-start/ranked)' };

  // ── D. online behavior metrics — honest null / "awaiting pilot" when there is no real data ──
  const o = input.online;
  const hasData = !!o && Number(o.impressions ?? 0) > 0;
  const onlineMetric = (key: keyof OnlineMetrics): MetricResult => hasData
    ? { value: Number(o![key] ?? 0), threshold: null, pass: true, note: 'live behavior metric (pilot data present)' }
    : { value: null, threshold: null, pass: true, awaitingPilot: true, note: 'awaiting real users (Track 7 pilot) — not fabricated' };
  const online: Record<string, MetricResult> = {
    clickThroughRate: onlineMetric('clickThroughRate'),
    saveRate: onlineMetric('saveRate'),
    cookRate: onlineMetric('cookRate'),
  };

  const offlinePass = Object.values(offline).every((m) => m.pass);
  const overallPass = allergySafety.pass && offlinePass;

  return { suite: 'RECSYS-OFFLINE-L4-15', catalogSize: input.catalog.length, fixtures: fixtures.length, deterministic: true, offline, allergySafety, online, overallPass };
}
