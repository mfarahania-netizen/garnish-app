/**
 * Deterministic TF-IDF search core (GARNISH-SEARCH-L4-08) — pure, local, reproducible.
 *
 * A principled content representation over the recipe corpus: TF-IDF vectors (L2-normalized, sparse)
 * + cosine similarity for query search and "similar recipes". NO external API, NO LLM, NO vector DB,
 * NO new dependency — just deterministic math. Every result is explainable (the overlapping terms).
 *
 * (TF-IDF cosine is chosen over BM25 for transparency + a bounded corpus; the index could be swapped for
 *  BM25 scoring behind the same interface without changing callers.)
 */

const STOPWORDS = new Set([
  // en
  'the', 'a', 'an', 'and', 'or', 'of', 'with', 'for', 'to', 'in', 'on', 'is', 'it', 'my', 'me', 'i', 'you', 'your',
  'recipe', 'recipes', 'food', 'dish', 'make', 'how', 'what', 'best', 'good', 'some', 'any', 'this', 'that',
  // fa
  'با', 'و', 'یا', 'برای', 'از', 'در', 'که', 'این', 'یک', 'به', 'را', 'تا', 'هم',
  'غذا', 'رسپی', 'دستور', 'طرز', 'تهیه', 'پخت', 'بهترین', 'چطور', 'چه',
]);

export function tokenize(text: unknown): string[] {
  if (text == null) return [];
  return String(text)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\u064a/g, '\u06cc') // Arabic Yeh -> Persian Yeh
    .replace(/\u0643/g, '\u06a9') // Arabic Kaf -> Persian Kaf
    .replace(/\u0629/g, '\u0647')
    .replace(/[\u064b-\u065f\u0670]/g, '') // Arabic/Persian diacritics
    .replace(/[\u200c\u200d\u200e\u200f]/g, ' ') // ZWNJ/RTL marks: شکم‌پر must match شکم پر
    .replace(/[[\]{}"'`,.!?()/\\:;|]/g, ' ')
    .split(/[\s_\-–—]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export interface SearchDocInput {
  id: string;
  title: string;
  /** weighted text fields — repeat a field's tokens to weight it (title/ingredients matter most). */
  text: string;
  facets?: Record<string, unknown>;
}

export interface IndexedDoc {
  id: string;
  title: string;
  vector: Map<string, number>; // term -> L2-normalized tf-idf
  facets: Record<string, unknown>;
  termCount: number;
}

export interface TfidfIndex {
  n: number;
  idf: Map<string, number>;
  docs: Map<string, IndexedDoc>;
  builtAt: string;
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/** Build the TF-IDF index. Deterministic: identical docs → identical index. */
export function buildTfidfIndex(docs: SearchDocInput[], now = '1970-01-01T00:00:00.000Z'): TfidfIndex {
  const n = docs.length;
  const tfByDoc = docs.map((d) => ({ d, tf: termFreq(tokenize(d.text)) }));

  // document frequency
  const df = new Map<string, number>();
  for (const { tf } of tfByDoc) for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);

  // smoothed idf
  const idf = new Map<string, number>();
  for (const [term, dfv] of df) idf.set(term, Math.log((n + 1) / (dfv + 1)) + 1);

  const indexed = new Map<string, IndexedDoc>();
  for (const { d, tf } of tfByDoc) {
    const maxTf = Math.max(1, ...tf.values());
    const raw = new Map<string, number>();
    for (const [term, c] of tf) raw.set(term, (0.5 + 0.5 * (c / maxTf)) * (idf.get(term) ?? 0)); // augmented tf × idf
    const norm = Math.sqrt([...raw.values()].reduce((s, v) => s + v * v, 0)) || 1;
    const vector = new Map<string, number>();
    for (const [term, v] of raw) vector.set(term, v / norm);
    indexed.set(d.id, { id: d.id, title: d.title, vector, facets: d.facets ?? {}, termCount: tf.size });
  }

  return { n, idf, docs: indexed, builtAt: now };
}

function queryVector(index: TfidfIndex, queryTokens: string[]): Map<string, number> {
  const tf = termFreq(queryTokens);
  const raw = new Map<string, number>();
  for (const [term, c] of tf) {
    const idf = index.idf.get(term);
    if (idf) raw.set(term, c * idf); // unseen query terms (idf undefined) contribute nothing
  }
  const norm = Math.sqrt([...raw.values()].reduce((s, v) => s + v * v, 0)) || 1;
  const out = new Map<string, number>();
  for (const [term, v] of raw) out.set(term, v / norm);
  return out;
}

function cosineSparse(a: Map<string, number>, b: Map<string, number>): { score: number; shared: string[] } {
  // iterate the smaller map
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  const shared: string[] = [];
  for (const [term, av] of small) {
    const bv = big.get(term);
    if (bv) { dot += av * bv; shared.push(term); }
  }
  return { score: dot, shared }; // both vectors are L2-normalized → dot product == cosine
}

export interface SearchHit { id: string; title: string; score: number; matchedTerms: string[] }

/** Rank docs by cosine to the query. Deterministic tie-break by id. */
export function searchIndex(index: TfidfIndex, query: string, limit = 20): SearchHit[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const qv = queryVector(index, qTokens);
  if (qv.size === 0) return []; // no query term exists in the corpus → honest empty (no fabrication)
  const hits: SearchHit[] = [];
  for (const doc of index.docs.values()) {
    const { score, shared } = cosineSparse(qv, doc.vector);
    if (score > 0) hits.push({ id: doc.id, title: doc.title, score: Math.round(score * 10000) / 10000, matchedTerms: shared.sort() });
  }
  hits.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
  return hits.slice(0, limit);
}

export interface SimilarHit extends SearchHit { sharedTerms: string[] }

/** Nearest neighbors of a doc by cosine. Deterministic tie-break by id. */
export function similarIndex(index: TfidfIndex, docId: string, limit = 6): SimilarHit[] {
  const base = index.docs.get(docId);
  if (!base) return [];
  const hits: SimilarHit[] = [];
  for (const doc of index.docs.values()) {
    if (doc.id === docId) continue;
    const { score, shared } = cosineSparse(base.vector, doc.vector);
    if (score > 0) hits.push({ id: doc.id, title: doc.title, score: Math.round(score * 10000) / 10000, matchedTerms: shared.sort(), sharedTerms: shared.sort() });
  }
  hits.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
  return hits.slice(0, limit);
}
