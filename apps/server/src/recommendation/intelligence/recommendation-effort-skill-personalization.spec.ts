import { scoreRecommendationCandidates } from './recommendation-shadow-scorer';
import { buildUserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.builder';
import { makeObs } from '../../behavior-engine/profile/profile-simulation-fixtures';
import { RecommendationCandidate, DecisionContext, DecisionHistory } from './recommendation-decision.types';

/**
 * ENGINE FIX — effort/skill personalization. Proves the two changed scorer formulas (desiredEffort, userSkill)
 * now genuinely personalize, on DECOUPLED candidates (effort and skill varied independently — unlike the
 * synthetic §8 corpus where skillLevel = SKILLS[effortIdx%3]). These are the intended-behaviour assertions;
 * they are not loosened — each pins a concrete directional outcome the fix is supposed to produce.
 */
const NOW = new Date('2026-06-14T00:00:00.000Z');
const WEEKDAY: DecisionContext = { surface: 'home', dayPart: 'evening', weekday: 3, mealSlot: 'dinner' };
const EMPTY: DecisionHistory = { exposures: [], outcomes: [] };

const C = (id: string, effort: string, skill: string): RecommendationCandidate => ({
  candidateId: id, recipeId: id, source: 'manual_fixture',
  estimatedEffort: effort as any, skillLevel: skill as any, mealSlot: 'dinner', cuisineTags: ['x'], noveltyTags: [],
});
const graphFor = (obs: any[]) => buildUserFoodIdentityGraph(obs, { userId: 'u', now: NOW, mode: 'offline_eval' }).graph!;
const score = (g: any, cands: RecommendationCandidate[]) => scoreRecommendationCandidates(g, cands, WEEKDAY, EMPTY, { mode: 'offline_eval', now: NOW });
const bd = (t: any, id: string) => t.candidates.find((c: any) => c.candidateId === id)!.scoreBreakdown;

describe('ENGINE FIX — effort personalization (weekday is a lean, not a hard cap)', () => {
  it('a high-effort-preference user IS served high effort on a WEEKDAY (old [0.25,0.5] cap removed)', () => {
    const g = graphFor([makeObs('u', { key: 'effort.quick_meal_preference', strength: -0.9, confidence: 0.7, evidenceCount: 8 }, NOW)]);
    const t = score(g, [C('very_low', 'very_low', 'beginner'), C('medium', 'medium', 'intermediate'), C('very_high', 'very_high', 'advanced')]);
    expect(bd(t, 'very_high').effortFit).toBeGreaterThan(bd(t, 'medium').effortFit); // high-effort lover gets high effort
    expect(bd(t, 'very_high').effortFit).toBeGreaterThan(bd(t, 'very_low').effortFit); // NOT capped to low/medium on a weekday
  });

  it('a quick-meal-preference user is still served low effort on a weekday (the mild lean is preserved)', () => {
    const g = graphFor([makeObs('u', { key: 'effort.quick_meal_preference', strength: 0.9, confidence: 0.7, evidenceCount: 8 }, NOW)]);
    const t = score(g, [C('very_low', 'very_low', 'beginner'), C('very_high', 'very_high', 'advanced')]);
    expect(bd(t, 'very_low').effortFit).toBeGreaterThan(bd(t, 'very_high').effortFit);
  });
});

describe('ENGINE FIX — skill personalization (userSkill spans the range, no 0.4 floor)', () => {
  it('a true beginner is steered to beginner recipes over BOTH intermediate and advanced (low userSkill)', () => {
    // effort held constant (medium) so skillFit is isolated. Under the OLD 0.4 floor a beginner read ~0.56 and
    // preferred INTERMEDIATE recipes; with the floor removed (userSkill ~0.21) the beginner correctly prefers beginner.
    const g = graphFor([makeObs('u', { key: 'skill.technique_confidence', strength: -0.95, confidence: 0.7, evidenceCount: 8 }, NOW)]);
    const t = score(g, [C('beg', 'medium', 'beginner'), C('int', 'medium', 'intermediate'), C('adv', 'medium', 'advanced')]);
    expect(bd(t, 'beg').skillFit).toBeGreaterThan(bd(t, 'int').skillFit);
    expect(bd(t, 'beg').skillFit).toBeGreaterThan(bd(t, 'adv').skillFit);
  });

  it('an advanced cook is served advanced recipes over beginner ones (high userSkill)', () => {
    const g = graphFor([makeObs('u', { key: 'skill.technique_confidence', strength: 0.95, confidence: 0.7, evidenceCount: 8 }, NOW)]);
    const t = score(g, [C('beg', 'medium', 'beginner'), C('adv', 'medium', 'advanced')]);
    expect(bd(t, 'adv').skillFit).toBeGreaterThan(bd(t, 'beg').skillFit);
  });

  it('skillFit ordering FLIPS between a beginner and an advanced user (the signal genuinely differentiates)', () => {
    const begUser = graphFor([makeObs('u', { key: 'skill.technique_confidence', strength: -0.95, confidence: 0.7, evidenceCount: 8 }, NOW)]);
    const advUser = graphFor([makeObs('u', { key: 'skill.technique_confidence', strength: 0.95, confidence: 0.7, evidenceCount: 8 }, NOW)]);
    const cands = [C('beg', 'medium', 'beginner'), C('adv', 'medium', 'advanced')];
    const begT = score(begUser, cands); const advT = score(advUser, cands);
    // beginner favours the beginner recipe; advanced favours the advanced recipe — opposite orderings.
    expect(bd(begT, 'beg').skillFit - bd(begT, 'adv').skillFit).toBeGreaterThan(0);
    expect(bd(advT, 'adv').skillFit - bd(advT, 'beg').skillFit).toBeGreaterThan(0);
  });
});

describe('ENGINE FIX — guardrails (ranking-only change)', () => {
  it('productUseEnabled stays false (shadow-only; the fix changes ranking, never the live flip or allergy)', () => {
    const g = graphFor([makeObs('u', { key: 'skill.technique_confidence', strength: 0, confidence: 0.5, evidenceCount: 4 }, NOW)]);
    const t = score(g, [C('a', 'medium', 'intermediate')]);
    expect(t.productUseEnabled).toBe(false);
  });
});
