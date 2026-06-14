import { scoreRecommendationCandidates, rankingFingerprint, SCORING_WEIGHTS } from './recommendation-shadow-scorer';
import { buildSimulationGraphs, SIMULATION_CANDIDATES, buildSimulationHistories } from './recommendation-decision-simulation-fixtures';
import { DecisionContext, DecisionHistory } from './recommendation-decision.types';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const CTX: DecisionContext = { surface: 'home', dayPart: 'midday', weekday: 3, mealSlot: 'lunch' };
const EMPTY: DecisionHistory = { exposures: [], outcomes: [] };
const graphs = buildSimulationGraphs(NOW);
const graph = (id: string) => graphs.find((g) => g.id === id)!.graph;
const sc = (id: string, ctx = CTX, hist = EMPTY) => scoreRecommendationCandidates(graph(id), SIMULATION_CANDIDATES, ctx, hist, { mode: 'offline_eval', now: NOW });

describe('E18/A5 recommendation shadow scorer', () => {
  it('produces a v1 trace with productUseEnabled false; all scores/confidence in [0,1]', () => {
    const t = sc('sim-quick-weekday');
    expect(t.version).toBe(1);
    expect(t.productUseEnabled).toBe(false);
    expect(t.candidates.every((c) => c.score >= 0 && c.score <= 1 && c.confidence >= 0 && c.confidence <= 1)).toBe(true);
  });

  it('weights are transparent and documented (positive-fit sum 0.88)', () => {
    const posSum = SCORING_WEIGHTS.tasteFit + SCORING_WEIGHTS.effortFit + SCORING_WEIGHTS.skillFit + SCORING_WEIGHTS.routineFit + SCORING_WEIGHTS.feedbackFit + SCORING_WEIGHTS.noveltyFit;
    expect(Math.abs(posSum - 0.88)).toBeLessThan(1e-9);
  });

  it('is deterministic (identical input -> identical trace + fingerprint)', () => {
    expect(JSON.stringify(sc('sim-high-skill'))).toBe(JSON.stringify(sc('sim-high-skill')));
    expect(rankingFingerprint(sc('sim-high-skill'))).toBe(rankingFingerprint(sc('sim-high-skill')));
  });

  it('blocks an unsafe candidate and lists it in safety.blockedCandidateIds', () => {
    const t = sc('sim-quick-weekday');
    const unsafe = t.candidates.find((c) => c.candidateId === 'cand_unsafe')!;
    expect(unsafe.decision).toBe('block');
    expect(t.safety.blockedCandidateIds).toContain('cand_unsafe');
  });

  it('sparse-metadata candidate gets warnings and is not top-ranked', () => {
    const t = sc('sim-high-skill');
    const sparse = t.candidates.find((c) => c.candidateId === 'cand_sparse')!;
    expect(sparse.warnings.length).toBeGreaterThan(0);
    expect(sparse.rank).toBeGreaterThan(1);
  });

  it('does not use notificationBehavior dimension for ranking', () => {
    const t = sc('sim-notif-fatigued');
    expect(t.candidates.every((c) => !c.evidence.graphDimensionsUsed.includes('notificationBehavior'))).toBe(true);
  });

  it('different users produce different ranking fingerprints', () => {
    expect(rankingFingerprint(sc('sim-quick-weekday'))).not.toBe(rankingFingerprint(sc('sim-weekend-explorer')));
  });

  it('overexposed candidate scores lower with overexposure history', () => {
    const hist = buildSimulationHistories(NOW).find((h) => h.id === 'hist_overexposed')!.history;
    const withHist = sc('sim-weekend-explorer', CTX, hist);
    const without = sc('sim-weekend-explorer', CTX, EMPTY);
    const a = withHist.candidates.find((c) => c.candidateId === 'cand_overexposed')!.score;
    const b = without.candidates.find((c) => c.candidateId === 'cand_overexposed')!.score;
    expect(a).toBeLessThan(b);
  });

  it('never throws on garbage candidates/history', () => {
    expect(() => scoreRecommendationCandidates(graph('sim-quick-weekday'), [null, 42, {}] as any, CTX, null as any, { mode: 'offline_eval', now: NOW })).not.toThrow();
  });

  it('respects maxCandidates and includeSuppressed options', () => {
    const t = scoreRecommendationCandidates(graph('sim-quick-weekday'), SIMULATION_CANDIDATES, CTX, EMPTY, { mode: 'offline_eval', now: NOW, maxCandidates: 5 });
    expect(t.candidates.length).toBe(5);
    const onlyRecommend = scoreRecommendationCandidates(graph('sim-quick-weekday'), SIMULATION_CANDIDATES, CTX, EMPTY, { mode: 'offline_eval', now: NOW, includeSuppressed: false });
    expect(onlyRecommend.candidates.every((c) => c.decision === 'recommend_shadow')).toBe(true);
  });
});
