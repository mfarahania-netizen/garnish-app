import { RecipeSafetyFilterService } from './recipe-safety-filter.service';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
function profile(allergens: string[], cultural?: string[], diet = 'omnivore') {
  const d = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: diet, declaredAt: NOW.toISOString() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
  if (allergens.length) d.dimensions['dietary.allergies_intolerances'] = { ...d.dimensions['dietary.allergies_intolerances'], status: 'declared', value: allergens, confidence: 0.9, recencyScore: 1 } as any;
  if (cultural?.length) (d.dimensions as any)['dietary.cultural_constraints'] = { status: 'declared', value: cultural, confidence: 0.9 };
  return composeLivingUserProfile(d, null, NOW);
}
const RECIPES = [
  { id: 'peanut', title: 'Peanut Stew', allergens: [], containsPork: false, ingredients: [{ name: 'peanut', ingredient: { allergens: { us9: ['peanut'], eu14: ['peanut'], other: [], mayContain: [] } } }] },
  // Regression for the real recipe 1051 shape: Recipe.allergens may be empty; the resolved dictionary relation is
  // the authoritative derived source used by the hard gate.
  { id: 'celery', title: 'Celery Stew', allergens: [], containsPork: false, ingredients: [{ name: 'celery', ingredient: { allergens: { us9: [], eu14: ['celery'], other: [], mayContain: [] } } }] },
  // Mechanics remain ready for future sulphites-tagged ingredients, but the onboarding option is deferred until
  // the live corpus actually contains one (enforced by the DB-backed coverage audit).
  { id: 'sulphites', title: 'Preserved Food', allergens: [], containsPork: false, ingredients: [{ name: 'preservative', ingredient: { allergens: { us9: [], eu14: ['sulfites'], other: [], mayContain: [] } } }] },
  { id: 'pork', title: 'Pork Belly', allergens: [], containsPork: true, ingredients: [{ name: 'pork', ingredient: { allergens: null } }] },
  { id: 'safe', title: 'Rice', allergens: [], containsPork: false, ingredients: [{ name: 'rice', ingredient: { allergens: null } }] },
  { id: 'vegan-safe', title: 'Vegan Bowl', diet: 'vegan', allergens: [], containsPork: false, ingredients: [{ name: 'rice', ingredient: { allergens: null } }] },
  { id: 'omnivore-only', title: 'Chicken Bowl', diet: 'omnivore', allergens: [], containsPork: false, ingredients: [{ name: 'chicken', ingredient: { allergens: null } }] },
];
function make(profileImpl: () => Promise<any>) {
  const prisma: any = { recipe: { findMany: jest.fn(({ where }: any) => Promise.resolve(RECIPES.filter((r) => where.id.in.includes(r.id)))) } };
  const profiles: any = { getLivingUserProfile: jest.fn(profileImpl) };
  return new RecipeSafetyFilterService(prisma, profiles);
}
const ALL = RECIPES.map((recipe) => recipe.id);

describe('RecipeSafetyFilterService — the ONE reusable hard gate', () => {
  it('anonymous (no userId) → pass-through (no declared allergy profile to enforce)', async () => {
    const svc = make(async () => profile([]));
    expect(await svc.safeIds(undefined, ALL)).toEqual(ALL);
    expect(await svc.safeIds(null as any, ALL)).toEqual(ALL);
  });

  it('authed declared-peanut user → peanut dropped, safe kept', async () => {
    const svc = make(async () => profile(['peanut']));
    const ids = await svc.safeIds('u1', ALL);
    expect(ids).not.toContain('peanut');
    expect(ids).toContain('safe');
  });

  it('derives celery from the resolved ingredient relation and drops recipe 1051-shaped rows', async () => {
    const svc = make(async () => profile(['celery']));
    expect(await svc.safeIds('u1', ALL)).not.toContain('celery');
  });

  it('canonicalizes sulfites spelling when tagged data is eventually available', async () => {
    const svc = make(async () => profile(['sulphites']));
    expect(await svc.safeIds('u1', ALL)).not.toContain('sulphites');
  });

  it('authed halal user → pork dropped (observance)', async () => {
    const svc = make(async () => profile([], ['halal']));
    expect(await svc.safeIds('u1', ALL)).not.toContain('pork');
  });

  it('FAILS CLOSED — if the profile (or its allergy read) throws, returns nothing', async () => {
    const svc = make(async () => { throw new Error('allergy table down'); });
    expect(await svc.safeIds('u1', ALL)).toEqual([]);
  });

  it('enforces restrictive diet patterns in the shared serving gate', async () => {
    const svc = make(async () => profile([], undefined, 'vegan'));
    const ids = await svc.safeIds('u1', ['vegan-safe', 'omnivore-only']);
    expect(ids).toEqual(['vegan-safe']);
  });

  it('filter() preserves object shape + order, drops unsafe', async () => {
    const svc = make(async () => profile(['peanut']));
    const rows = ALL.map((id) => ({ id, extra: id }));
    const out = await svc.filter('u1', rows);
    expect(out.map((r) => r.id)).not.toContain('peanut');
    expect(out.find((r) => r.id === 'safe')?.extra).toBe('safe');
  });
});
