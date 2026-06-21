import { RecipePriorLearnerService } from './recipe-prior-learner.service';

function run(opts: { served: any[]; attr?: any[]; cooks?: any[]; users?: any[] }) {
  const upserts: any[] = [];
  const prisma: any = {
    recommendationServedItem: { findMany: jest.fn().mockResolvedValue(opts.served) },
    recommendationAttributionEvent: { findMany: jest.fn().mockResolvedValue(opts.attr ?? []) },
    userEvent: { findMany: jest.fn().mockResolvedValue(opts.cooks ?? []) },
    user: { findMany: jest.fn().mockResolvedValue(opts.users ?? []) },
    recipePrior: { upsert: jest.fn(async (a: any) => { upserts.push(a); return {}; }) },
  };
  return { svc: new RecipePriorLearnerService(prisma), upserts };
}
const row = (upserts: any[], recipeId: string, scope: string, scopeKey: string) =>
  upserts.find((u) => { const w = u.where.recipeId_scope_scopeKey; return w.recipeId === recipeId && w.scope === scope && w.scopeKey === scopeKey; });
// reward events on the canonical scale (the learner recomputes from eventType, not the stored value)
const ev = (requestId: string, recipeId: string, eventType: string) => ({ requestId, recipeId, eventType });

describe('RecipePriorLearnerService (L1 step 4)', () => {
  it('no-ops when the table/client is absent (never throws)', async () => {
    const svc = new RecipePriorLearnerService({} as any);
    await expect(svc.refresh()).resolves.toBeUndefined();
  });

  it('writes 3 scopes per impression, centers on the IPS-weighted baseline, folds the EU occasion into cohort', async () => {
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: JSON.stringify({ europeanOccasion: { key: 'christmas' } }) },
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null },
      ],
      attr: [ev('q1', 'r1', 'recommendation_cook')], // r1 cooked; r2 nothing
      users: [
        { id: 'u1', country: 'NL', locale: 'nl-NL', preferences: null },
        { id: 'u2', country: 'DE', locale: 'de-DE', preferences: null },
      ],
    });
    const res: any = await svc.refresh();
    expect(res).toEqual({ impressions: 2, scopeRows: 6 });

    // baseline = (2*1 + 2*0)/4 = 0.5 → r1 centered +0.5, r2 centered -0.5
    expect(row(upserts, 'r1', 'person', 'u1').create.mean).toBeCloseTo(0.5, 6);
    expect(row(upserts, 'r2', 'person', 'u2').create.mean).toBeCloseTo(-0.5, 6);
    // EU occasion (Christmas) folded into the cohort key via the shared mapper
    expect(row(upserts, 'r1', 'cohort', 'country=nl;occasion=christmas')).toBeTruthy();
    expect(row(upserts, 'r2', 'cohort', 'country=de')).toBeTruthy();
    expect(row(upserts, 'r1', 'population', '')).toBeTruthy();
  });

  it('IPS: a rarely-shown impression carries MORE effective sample size (n = Σ clipped 1/propensity)', async () => {
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.05, requestId: 'q1', contextJson: null }, // w = 20
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null }, //  w = 2
      ],
      attr: [ev('q1', 'r1', 'recommendation_cook'), ev('q2', 'r2', 'recommendation_cook')],
      users: [{ id: 'u1', country: 'NL' }, { id: 'u2', country: 'NL' }],
    });
    await svc.refresh();
    expect(row(upserts, 'r1', 'person', 'u1').create.n).toBe(20);
    expect(row(upserts, 'r2', 'person', 'u2').create.n).toBe(2);
  });

  it('clips IPS weight at W_CAP=20 (propensity below the 0.02 floor cannot blow up)', async () => {
    const { svc, upserts } = run({
      served: [{ userId: 'u1', recipeId: 'r1', propensity: 0.0001, requestId: 'q1', contextJson: null }],
      attr: [ev('q1', 'r1', 'recommendation_cook')],
      users: [{ id: 'u1', country: 'NL' }],
    });
    await svc.refresh();
    expect(row(upserts, 'r1', 'person', 'u1').create.n).toBe(20);
  });

  it('collapses the funnel to the STRONGEST signal (argmax), not the sum', async () => {
    // r1 = click(0.2)+save(0.6) → argmax 0.6 (NOT sum 0.8); r2 = nothing (0). baseline = (2*0.6+0)/4 = 0.3.
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: null },
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null },
      ],
      attr: [ev('q1', 'r1', 'recommendation_click'), ev('q1', 'r1', 'recommendation_save')],
      users: [{ id: 'u1', country: 'NL' }, { id: 'u2', country: 'NL' }],
    });
    await svc.refresh();
    expect(row(upserts, 'r1', 'person', 'u1').create.mean).toBeCloseTo(0.6 - 0.3, 6); // 0.3 (argmax 0.6), not 0.5 (sum 0.8)
  });

  it('a bare impression (and a served-but-no-action) scores reward 0, not the producer +0.1', async () => {
    // r1 only has an impression row (canonical 0); r2 cooked (1). baseline=(2*0+2*1)/4=0.5 → r1 centered -0.5.
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: null },
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null },
      ],
      attr: [ev('q1', 'r1', 'recommendation_impression'), ev('q2', 'r2', 'recommendation_cook')],
      users: [{ id: 'u1', country: 'NL' }, { id: 'u2', country: 'NL' }],
    });
    await svc.refresh();
    expect(row(upserts, 'r1', 'person', 'u1').create.mean).toBeCloseTo(-0.5, 6);
  });

  it('uses the CANONICAL reward scale (dismiss = -0.8, not the producer -1.0)', async () => {
    // r1 = dismiss(-0.8); r2 = nothing(0). baseline=(2*-0.8+0)/4=-0.4 → r1 centered -0.4.
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: null },
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null },
      ],
      attr: [ev('q1', 'r1', 'recommendation_dismiss')],
      users: [{ id: 'u1', country: 'NL' }, { id: 'u2', country: 'NL' }],
    });
    await svc.refresh();
    expect(row(upserts, 'r1', 'person', 'u1').create.mean).toBeCloseTo(-0.4, 6); // -0.8 centered → confirms -0.8 scale
  });

  it('NO-LOST-SIGNALS: an organic cook with only a weaker click attribution still wins (max)', async () => {
    // r1 = click(0.2) attributed BUT also organically cooked → reward max(0.2, 1.0)=1.0; r2 = nothing(0).
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: null },
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null },
      ],
      attr: [ev('q1', 'r1', 'recommendation_click')],
      cooks: [{ userId: 'u1', recipeId: 'r1' }],
      users: [{ id: 'u1', country: 'NL' }, { id: 'u2', country: 'NL' }],
    });
    await svc.refresh();
    // baseline=(2*1+2*0)/4=0.5 → r1 centered +0.5 (cook won, NOT the 0.2 click which would give +0.1 baseline shift)
    expect(row(upserts, 'r1', 'person', 'u1').create.mean).toBeCloseTo(0.5, 6);
  });

  it('NO-LOST-SIGNALS: an organic cook with no attribution row is credited', async () => {
    const { svc, upserts } = run({
      served: [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: null },
        { userId: 'u2', recipeId: 'r2', propensity: 0.5, requestId: 'q2', contextJson: null },
      ],
      attr: [],
      cooks: [{ userId: 'u1', recipeId: 'r1' }],
      users: [{ id: 'u1', country: 'NL' }, { id: 'u2', country: 'NL' }],
    });
    await svc.refresh();
    expect(row(upserts, 'r1', 'person', 'u1').create.mean).toBeCloseTo(0.5, 6);
    expect(row(upserts, 'r2', 'person', 'u2').create.mean).toBeCloseTo(-0.5, 6);
  });

  it('never writes populationMu (the curated seed is preserved on update)', async () => {
    const { svc, upserts } = run({
      served: [{ userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'q1', contextJson: null }],
      attr: [ev('q1', 'r1', 'recommendation_cook')],
      users: [{ id: 'u1', country: 'NL' }],
    });
    await svc.refresh();
    for (const u of upserts) {
      expect(Object.keys(u.update)).not.toContain('populationMu');
      expect(Object.keys(u.create)).not.toContain('populationMu');
    }
  });

  it('no served items in window → no-op (0 scope rows)', async () => {
    const { svc } = run({ served: [] });
    expect(await svc.refresh()).toEqual({ impressions: 0, scopeRows: 0 });
  });
});
