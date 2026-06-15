/**
 * GARNISH-EMBED-L4-13 — canonical recipe content representation (pure, deterministic, local).
 *
 * ONE source of truth for "what a recipe is, content-wise", reused by:
 *   • the TF-IDF index (search + similar)            → buildContentDoc(recipe).text/facets
 *   • the content feature store + candidate embedding → buildContentVector(recipe)
 *   • explainable similarity                          → extractFacets + facetSimilarity
 *
 * NO external API, NO LLM, NO vector DB, NO new dependency, NO Math.random — just deterministic content
 * features over resolved ingredients + title/description + diet/mealType/cuisine/effort facets. Replaces
 * the old 48-dim feature-hash stub with a principled, interpretable, reproducible vector.
 */
import { tokenize } from './tfidf';
import { toStringArray } from '../../ai/tools/grounding-utils';

export interface RecipeContentInput {
  id?: string;
  title?: string | null;
  description?: string | null;
  diet?: string | null;
  mealType?: string | null;
  region?: string | null;
  category?: string | null;
  categories?: unknown;
  difficulty?: string | null;
  cookingTime?: number | null;
  ingredients?: Array<{ name?: string | null } | string> | null;
  searchTerms?: Array<{ term?: string | null } | string> | null;
}

export type EffortBand = 'quick' | 'medium' | 'long' | 'unknown';

export interface ContentFacets {
  cuisine: string | null; // region or first category, normalized
  diet: string | null;
  mealType: string | null;
  difficulty: string | null;
  effortBand: EffortBand;
}

const norm = (s: unknown): string | null => {
  const v = String(s ?? '').trim().toLowerCase();
  return v.length ? v : null;
};

function ingredientNames(r: RecipeContentInput): string[] {
  return (r.ingredients ?? []).map((i) => (typeof i === 'string' ? i : i?.name)).filter((x): x is string => !!x);
}
function searchTermValues(r: RecipeContentInput): string[] {
  return (r.searchTerms ?? []).map((t) => (typeof t === 'string' ? t : t?.term)).filter((x): x is string => !!x);
}

export function effortBand(cookingTime?: number | null): EffortBand {
  const m = Number(cookingTime ?? 0);
  if (!(m > 0)) return 'unknown';
  if (m <= 20) return 'quick';
  if (m <= 45) return 'medium';
  return 'long';
}

export function extractFacets(r: RecipeContentInput): ContentFacets {
  const cats = toStringArray(r.categories);
  return {
    cuisine: norm(r.region) ?? norm(r.category) ?? (cats[0] ? norm(cats[0]) : null),
    diet: norm(r.diet),
    mealType: norm(r.mealType),
    difficulty: norm(r.difficulty),
    effortBand: effortBand(r.cookingTime),
  };
}

export interface ContentDoc {
  id: string;
  title: string;
  text: string;
  facets: Record<string, unknown>;
}

/**
 * Canonical weighted content document feeding the TF-IDF index. Title ×3 and ingredients ×2 (they matter
 * most for recipe content), plus description / diet / mealType / cuisine / categories / search terms.
 * (Kept token-equivalent to the prior search doc builder so search ranking stays stable while unifying
 * the representation.)
 */
export function buildContentDoc(r: RecipeContentInput): ContentDoc {
  const ingredients = ingredientNames(r);
  const terms = searchTermValues(r);
  const cats = toStringArray(r.categories);
  const text = [r.title, r.title, r.title, ...ingredients, ...ingredients, r.description, r.diet, r.mealType, r.region, ...cats, ...terms]
    .filter(Boolean)
    .join(' ');
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    text,
    facets: { diet: r.diet, mealType: r.mealType, region: r.region, difficulty: r.difficulty, cookingTime: r.cookingTime, categories: cats },
  };
}

// ── principled deterministic dense vector (replaces the 48-dim hash stub) ──
export const CONTENT_VECTOR_DIM = 64;
const FACET_DIMS = 16; // interpretable block [0..16); token block fills [16..64)

/** Stable FNV-1a hash (deterministic — NOT Math.random). */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a principled, interpretable, L2-normalized content vector:
 *   dims 0..15  — explicit facet flags (diet / mealType / effort / difficulty / cuisine bucket)
 *   dims 16..63 — weighted content-token bag (title ×3, ingredients ×2, categories, terms), stable-hashed
 * Deterministic + reproducible: identical input → identical vector.
 */
export function buildContentVector(r: RecipeContentInput): number[] {
  const v = new Array(CONTENT_VECTOR_DIM).fill(0);
  const f = extractFacets(r);
  const diet = f.diet ?? '';
  if (/vegetarian/.test(diet)) v[0] = 1;
  if (/vegan/.test(diet)) v[1] = 1;
  if (/omnivore|meat|chicken|beef/.test(diet)) v[2] = 1;
  if (/gluten|gf/.test(diet)) v[3] = 1;
  if (f.mealType === 'breakfast' || /breakfast|صبحانه/.test(f.mealType ?? '')) v[4] = 1;
  if (f.mealType === 'lunch' || /lunch|ناهار/.test(f.mealType ?? '')) v[5] = 1;
  if (f.mealType === 'dinner' || /dinner|شام/.test(f.mealType ?? '')) v[6] = 1;
  if (/snack|dessert|دسر/.test(f.mealType ?? '')) v[7] = 1;
  if (f.effortBand === 'quick') v[8] = 1;
  if (f.effortBand === 'medium') v[9] = 1;
  if (f.effortBand === 'long') v[10] = 1;
  if (/easy|beginner|ساده|آسان/.test(f.difficulty ?? '')) v[11] = 1;
  if (/medium|متوسط/.test(f.difficulty ?? '')) v[12] = 1;
  if (/hard|advanced|سخت|پیشرفته/.test(f.difficulty ?? '')) v[13] = 1;
  if (f.cuisine) { v[14] = 1; v[15] = ((fnv1a(f.cuisine) % 1000) / 1000); } // cuisine present + stable bucket

  const tokenSpace = CONTENT_VECTOR_DIM - FACET_DIMS;
  const add = (tokens: string[], weight: number) => {
    for (const tok of tokens) v[FACET_DIMS + (fnv1a(tok) % tokenSpace)] += weight;
  };
  add(tokenize(r.title), 3);
  add(ingredientNames(r).flatMap((n) => tokenize(n)), 2);
  add(toStringArray(r.categories).flatMap((c) => tokenize(c)), 1);
  add(searchTermValues(r).flatMap((t) => tokenize(t)), 1);

  const l2 = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (l2 === 0) return v;
  return v.map((x) => Math.round((x / l2) * 1000) / 1000);
}

export function cosineDense(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Facet overlap in [0,1] — how many shared content facets (cuisine/diet/mealType/effort/difficulty). */
export function facetSimilarity(a: ContentFacets, b: ContentFacets): number {
  const keys: (keyof ContentFacets)[] = ['cuisine', 'diet', 'mealType', 'effortBand', 'difficulty'];
  let considered = 0, matched = 0;
  for (const k of keys) {
    const av = a[k], bv = b[k];
    if (av && bv && av !== 'unknown' && bv !== 'unknown') {
      considered++;
      if (av === bv) matched++;
    }
  }
  return considered === 0 ? 0 : matched / considered;
}

/** Blend a TF-IDF term-cosine score with a facet bonus → better-ranked, still-explainable similarity. */
export function blendSimilarity(termScore: number, facetSim: number): number {
  return Math.round((termScore * (1 + 0.25 * facetSim)) * 10000) / 10000;
}
