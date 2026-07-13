import { RankingService } from './ranking.service';
import { TasteAffinityBuilder, TASTE_NEUTRAL } from '../taste-affinity/taste-affinity.builder';

// Dormant post-provenance scoring primitive. These tests cover only bounded
// score math; they do not authorize reading or consuming recipe-prior data.
// P0-A Option B keeps the integration neutral until an evidence-bearing source
// contract and current-policy/current-epoch validation are implemented.
const svc: any = new RankingService(
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
);
const term = (vPrior: number, tasteAffinity: number) => svc.recipePriorSlateTerm(vPrior, tasteAffinity);

const STEP5_ENV = ['L1_PRIOR_STEP5_WEIGHT', 'L1_PRIOR_STEP5_LIFT_CAP', 'L1_PRIOR_STEP5_PEN_CAP', 'L1_PRIOR_STEP5_PEN_MULT', 'L1_PRIOR_STEP5_GATE_FULL'];
afterEach(() => STEP5_ENV.forEach((k) => delete process.env[k]));

describe('recipePriorSlateTerm — dormant future scoring contract', () => {
  it('DEFAULT-OFF: weight 0 ⇒ term is exactly 0 for any input (byte-identical)', () => {
    expect(term(1.0, 0.9)).toBe(0);
    expect(term(0.0, 0.1)).toBe(0);
    expect(term(0.5, 0.5)).toBe(0);
  });

  describe('synthetic post-provenance math (weight 0.3)', () => {
    beforeEach(() => { process.env.L1_PRIOR_STEP5_WEIGHT = '0.3'; });

    it('LIFTS a crowd-loved dish, bounded by liftCap (0.06)', () => {
      expect(term(1.0, 0.1)).toBeCloseTo(0.06, 6); // dev=1, raw=0.3 → capped at 0.06
      expect(term(0.5, 0.1)).toBe(0); // neutral prior → no lift
    });

    it('LIFT-ONLY by default: a below-neutral prior does NOT pull down (penMult 0)', () => {
      expect(term(0.0, 0.1)).toBe(0); // dev=-1, but penalty branch is inert at penMult=0
    });

    it('lift is NEVER gated by a strong personal signal (prior still helps when it agrees)', () => {
      expect(term(1.0, 0.95)).toBeCloseTo(0.06, 6);
    });
  });

  describe('synthetic two-sided math (penMult 1) — hard-floor invariant', () => {
    beforeEach(() => { process.env.L1_PRIOR_STEP5_WEIGHT = '0.3'; process.env.L1_PRIOR_STEP5_PEN_MULT = '1'; });

    it('HARD FLOOR: any positive personal signal (tasteAffinity > 0.35) ⇒ no pull-down', () => {
      expect(term(0.0, 0.36)).toBe(0); // just above the floor
      expect(term(0.0, 0.9)).toBe(0);
      expect(term(0.1, 0.5)).toBe(0); // below-neutral prior + liked → floored to 0
    });

    it('applies a BOUNDED penalty only when there is no personal signal (≤ 0.35)', () => {
      expect(term(0.0, 0.1)).toBeCloseTo(-0.02, 6); // dev=-1, raw=-0.3 → bounded to -penCap=-0.02
      expect(term(0.0, 0.35)).toBeCloseTo(-0.02, 6); // boundary: exactly 0.35 is NOT "> floor" → penalty allowed
    });

    it('penalty magnitude is non-increasing in tasteAffinity and 0 past the floor (gate monotonicity)', () => {
      const mags = [0, 0.1, 0.2, 0.34, 0.36, 0.5, 0.9].map((ta) => Math.abs(term(0.0, ta)));
      for (let i = 1; i < mags.length; i++) expect(mags[i]).toBeLessThanOrEqual(mags[i - 1] + 1e-9);
      expect(term(0.0, 0.9)).toBe(0);
    });

    it('asymmetric: max penalty magnitude (0.02) ≪ max lift (0.06)', () => {
      const maxPen = Math.abs(term(0.0, 0.1));
      const maxLift = term(1.0, 0.1);
      expect(maxPen).toBeLessThan(maxLift);
    });
  });

  it('INVARIANT (shipped default penMult=0): term ≥ 0 for ALL (weight, vPrior, tasteAffinity) — score can never drop', () => {
    for (const w of [0, 0.02, 0.05, 0.1, 0.2]) {
      process.env.L1_PRIOR_STEP5_WEIGHT = String(w);
      for (let v = 0; v <= 1.0001; v += 0.1) {
        for (let ta = 0; ta <= 1.0001; ta += 0.1) {
          expect(term(v, ta)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('INVARIANT (penMult=1): every recipe with a positive personal signal gets term ≥ 0 (hard floor)', () => {
    process.env.L1_PRIOR_STEP5_WEIGHT = '0.3';
    process.env.L1_PRIOR_STEP5_PEN_MULT = '1';
    for (let v = 0; v <= 1.0001; v += 0.1) {
      for (let ta = 0.36; ta <= 1.0001; ta += 0.1) {
        expect(term(v, ta)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('NaN-safe', () => {
    process.env.L1_PRIOR_STEP5_WEIGHT = '0.3';
    expect(term(NaN, 0.5)).toBe(0); // vPrior NaN → treated as neutral 0.5 → dev 0 → 0
    expect(Number.isFinite(term(0.0, NaN))).toBe(true);
  });
});

describe('TASTE_NEUTRAL coupling (anchor cannot drift from the builder floor)', () => {
  it('the builder zero-evidence score equals TASTE_NEUTRAL', () => {
    const builder = new TasteAffinityBuilder();
    const score = builder.build({ title: 'x', ingredients: [], searchTerms: [] } as any, {}).score;
    expect(score).toBe(TASTE_NEUTRAL);
  });
});
