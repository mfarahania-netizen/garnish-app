import { coldStartWeightBlend, coldStartBlendEnabled, COLDSTART_BLEND_FLAG } from './coldstart';

const BASE = { tasteAffinity: 0.27, behaviorFit: 0.22, outcomeFit: 0.17, novelty: 0.09, popularity: 0.04, recency: 0.02, recipeUnderstanding: 0.1, ingredientIntelligence: 0.09 };
const sum = (w: Record<string, number>) => Object.values(w).reduce((s, v) => s + v, 0);

describe('cold-start ranking blend — history-aware, deterministic, flagged', () => {
  it('rich history (reliability ≥ 0.65) → base weights unchanged', () => {
    expect(coldStartWeightBlend(BASE, 0.8)).toEqual(BASE);
    expect(coldStartWeightBlend(BASE, 0.65)).toEqual(BASE);
  });

  it('thin history leans toward content + popularity, away from behaviour/outcome', () => {
    const thin = coldStartWeightBlend(BASE, 0.0);
    expect(thin.behaviorFit).toBeLessThan(BASE.behaviorFit);
    expect(thin.outcomeFit).toBeLessThan(BASE.outcomeFit);
    expect(thin.recipeUnderstanding).toBeGreaterThan(BASE.recipeUnderstanding);
    expect(thin.popularity).toBeGreaterThan(BASE.popularity);
    expect(thin.ingredientIntelligence).toBeGreaterThan(BASE.ingredientIntelligence);
  });

  it('transitions SMOOTHLY: less reliable → stronger lean', () => {
    const lean = (r: number) => coldStartWeightBlend(BASE, r).behaviorFit;
    expect(lean(0.1)).toBeLessThan(lean(0.4)); // thinner history → behaviorFit pushed down more
    expect(lean(0.4)).toBeLessThan(lean(0.64));
  });

  it('DETERMINISTIC: same inputs → identical output (no randomness)', () => {
    expect(coldStartWeightBlend(BASE, 0.2)).toEqual(coldStartWeightBlend(BASE, 0.2));
  });

  it('flag: default ON; "false" disables', () => {
    const prev = process.env[COLDSTART_BLEND_FLAG];
    delete process.env[COLDSTART_BLEND_FLAG];
    expect(coldStartBlendEnabled()).toBe(true);
    process.env[COLDSTART_BLEND_FLAG] = 'false';
    expect(coldStartBlendEnabled()).toBe(false);
    if (prev === undefined) delete process.env[COLDSTART_BLEND_FLAG]; else process.env[COLDSTART_BLEND_FLAG] = prev;
  });
});
