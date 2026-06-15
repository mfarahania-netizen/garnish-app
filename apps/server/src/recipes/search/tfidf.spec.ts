import { tokenize, buildTfidfIndex, searchIndex, similarIndex, SearchDocInput } from './tfidf';

const DOCS: SearchDocInput[] = [
  { id: 'r1', title: 'Saffron Chicken Pilaf', text: 'saffron chicken pilaf rice persian chicken saffron rice dinner', facets: { region: 'persian', mealType: 'dinner' } },
  { id: 'r2', title: 'Vegan Lentil Soup', text: 'vegan lentil soup carrot onion lentil vegetables vegan healthy', facets: { diet: 'vegan' } },
  { id: 'r3', title: 'Chicken Kebab', text: 'chicken kebab grilled chicken skewer barbecue dinner persian', facets: { region: 'persian', mealType: 'dinner' } },
  { id: 'r4', title: 'Chocolate Cake', text: 'chocolate cake dessert flour sugar cocoa sweet baking', facets: { mealType: 'snack' } },
];

describe('tokenize', () => {
  it('lowercases, strips punctuation, drops stopwords + short tokens', () => {
    expect(tokenize('The BEST Chicken, with rice!')).toEqual(['chicken', 'rice']);
    expect(tokenize('غذا با مرغ و برنج')).toEqual(['مرغ', 'برنج']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('buildTfidfIndex', () => {
  const idx = buildTfidfIndex(DOCS);
  it('indexes all docs with L2-normalized vectors', () => {
    expect(idx.n).toBe(4);
    expect(idx.docs.size).toBe(4);
    const norm = Math.sqrt([...idx.docs.get('r1')!.vector.values()].reduce((s, v) => s + v * v, 0));
    expect(Math.abs(norm - 1)).toBeLessThan(1e-9); // unit vector
  });
  it('gives rarer terms higher idf than common ones', () => {
    expect(idx.idf.get('saffron')!).toBeGreaterThan(idx.idf.get('chicken')!); // chicken in 2 docs, saffron in 1
  });
  it('is deterministic (same input → identical scores)', () => {
    const a = searchIndex(buildTfidfIndex(DOCS), 'chicken dinner');
    const b = searchIndex(buildTfidfIndex(DOCS), 'chicken dinner');
    expect(a).toEqual(b);
  });
});

describe('searchIndex — meaning-aware ranking + WHY + honest empty', () => {
  const idx = buildTfidfIndex(DOCS);
  it('ranks the most relevant recipes first and reports matched terms (WHY)', () => {
    const hits = searchIndex(idx, 'saffron chicken');
    expect(hits[0].id).toBe('r1'); // saffron (rare) + chicken
    expect(hits[0].matchedTerms).toEqual(expect.arrayContaining(['saffron', 'chicken']));
    expect(hits.map((h) => h.id)).toContain('r3'); // chicken kebab also matches chicken
  });
  it('returns honest empty for a query with no corpus term (no fabrication)', () => {
    expect(searchIndex(idx, 'zzqx-not-a-food')).toEqual([]);
    expect(searchIndex(idx, '')).toEqual([]);
  });
  it('multi-term query weights rare terms (lentil → vegan soup top)', () => {
    expect(searchIndex(idx, 'lentil soup')[0].id).toBe('r2');
  });
});

describe('similarIndex — nearest neighbors, explainable', () => {
  const idx = buildTfidfIndex(DOCS);
  it('finds the most similar recipe by shared content and excludes self', () => {
    const sim = similarIndex(idx, 'r1'); // saffron chicken pilaf
    expect(sim.find((s) => s.id === 'r1')).toBeUndefined(); // self excluded
    expect(sim[0].id).toBe('r3'); // chicken kebab — shares chicken/persian/dinner
    expect(sim[0].sharedTerms.length).toBeGreaterThan(0);
  });
  it('returns [] for an unknown recipe id', () => {
    expect(similarIndex(idx, 'nope')).toEqual([]);
  });
});
