/**
 * Recipe integrity & normalization (GARNISH-RECIPE-L4-07) — pure, deterministic.
 *
 * Per-recipe integrity report (admin/internal): resolves ingredient refs against the 1008 dictionary
 * (via the dictionary entry already joined onto each RecipeIngredient — never fabricates a link),
 * derives allergens from resolved ingredients (INFORMATIONAL, not a safety guarantee), normalizes
 * diet/categories/mealType/occasion to controlled vocabularies (flags non-canonical), and sanity-checks
 * timings + servings. NO medical claims; missing data stays missing.
 */
import { toStringArray, norm } from '../../ai/tools/grounding-utils';
import onboardingAllergenPolicyJson from './onboarding-allergen-policy.json';

/**
 * Canonical onboarding disclosure policy. `enabled` means the CURRENT corpus has at least one published recipe
 * path whose ingredient metadata exercises the hard gate; it is deliberately NOT a medical-verification claim.
 * Deferred tokens stay accepted by the profile/chat write boundary, but must not be shown as useful onboarding
 * choices until the live-data audit proves coverage. The DB-backed audit is
 * `scripts/data/audit-onboarding-allergen-coverage.cjs`.
 */
export type OnboardingAllergenPolicyStatus = 'enabled' | 'deferred';
export interface OnboardingAllergenPolicyOption {
  id: string;
  status: OnboardingAllergenPolicyStatus;
  reason?: string;
}
export const ONBOARDING_ALLERGEN_POLICY = onboardingAllergenPolicyJson as {
  schemaVersion: number;
  policy: 'corpus_coverage_not_medical_verification';
  options: OnboardingAllergenPolicyOption[];
};
export const ENABLED_ONBOARDING_ALLERGEN_TOKENS = Object.freeze(
  ONBOARDING_ALLERGEN_POLICY.options.filter((option) => option.status === 'enabled').map((option) => option.id),
);

export const DIET_VOCAB = ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'mediterranean', 'keto', 'low_carb', 'paleo', 'halal', 'kosher'];
export const MEALTYPE_VOCAB = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface IntegrityReport {
  recipeId: string;
  ingredientResolution: { total: number; resolved: number; unresolved: number; unresolvedNames: string[]; coveragePct: number };
  derivedAllergens: { allergens: string[]; source: 'resolved_ingredient_dictionary'; informationalOnly: true };
  declaredAllergens: string[];
  vocabulary: { diet: VocabCheck; mealType: VocabCheck; categories: CategoryCheck; occasion: CategoryCheck };
  timing: { prepMin: number | null; cookMin: number | null; totalMin: number | null; consistent: boolean | null; note: string };
  servings: { value: number | null; sane: boolean };
  overallStatus: 'ok' | 'warnings' | 'incomplete';
  warnings: string[];
}

interface VocabCheck { value: string | null; normalized: string | null; canonical: boolean }
interface CategoryCheck { values: string[]; nonCanonical: string[] }

// SAFETY: alias → canonical allergen token(s). The dictionary historically mixed a malformed bare-array
// shape (e.g. ["nuts"], ["dairy"], ["gluten"]) with the object shape, and used inconsistent tokens; both
// were a hard-filter hole. We over-map ambiguous tokens (seafood → fish+shellfish, gluten → both wheat
// forms) because over-flagging an allergen is SAFE and under-flagging is dangerous.
const ALLERGEN_ALIASES: Record<string, string[]> = {
  nuts: ['tree_nuts'], nut: ['tree_nuts'], treenuts: ['tree_nuts'], 'tree nuts': ['tree_nuts'], 'tree-nuts': ['tree_nuts'],
  peanuts: ['peanut'], groundnut: ['peanut'], groundnuts: ['peanut'],
  dairy: ['milk'], lactose: ['milk'],
  gluten: ['gluten_cereals', 'wheat'], wheat: ['wheat', 'gluten_cereals'], 'gluten_cereal': ['gluten_cereals'],
  // SAFETY umbrella: someone who declares "shellfish" (or "seafood") is medically at risk from BOTH crustaceans
  // AND molluscs, so the umbrella expands to the specific EU-14 tokens (over-warn — the safe direction). Without
  // this, an oyster-sauce (molluscs) dish would not be filtered for a "shellfish"-allergic user even though the
  // ingredient now correctly carries the molluscs token.
  seafood: ['fish', 'shellfish', 'crustaceans', 'molluscs'], shellfish: ['shellfish', 'crustaceans', 'molluscs'], crustacean: ['crustaceans'], crustaceans: ['crustaceans'], molluscs: ['molluscs'], mollusks: ['molluscs'], mollusc: ['molluscs'], mollusk: ['molluscs'],
  // SAFETY (live under-match found in the ingredient dictionary): variant spellings of the crustacean token were
  // passing through verbatim, so the shellfish umbrella ([shellfish,crustaceans,molluscs]) never matched them and a
  // shellfish-allergic user was NOT protected from those entries. Canonicalize the variants to crustaceans.
  'crustacean shellfish': ['crustaceans'], crustacean_shellfish: ['crustaceans'], 'crustacean-shellfish': ['crustaceans'],
  soya: ['soy'], soybean: ['soy'], soybeans: ['soy'],
  egg: ['eggs'],
  // EU-14 completeness (decision: full chip set). fish/mustard/celery/lupin already appear in recipes or the
  // dictionary, so these chips are live immediately; sulphites has no data yet (chip is safe-but-inert until
  // ingredients are tagged). Map the common spelling variants to one canonical token each so profile- and
  // recipe-side tokens always intersect regardless of how the data was authored.
  celeriac: ['celery'],
  lupine: ['lupin'], lupins: ['lupin'],
  'mustard seed': ['mustard'], 'mustard seeds': ['mustard'],
  finfish: ['fish'],
  sulphite: ['sulphites'], sulfite: ['sulphites'], sulfites: ['sulphites'],
  'sulphur dioxide': ['sulphites'], sulphur_dioxide: ['sulphites'], 'sulfur dioxide': ['sulphites'], sulfur_dioxide: ['sulphites'], so2: ['sulphites'],
  // ── CRITICAL (final-audit fix): the live recipe corpus authors recipe.allergens in PERSIAN (and the EU launch
  // will add Dutch), but the profile chips are English ids — without these the gate canonicalized the two sides to
  // DIFFERENT tokens, never intersected, and FAILED OPEN (a nut-allergic user was served a nut dish). Keys are in
  // the light-folded form canonicalizeAllergens produces (ZWNJ→space, ي/ك/آ folded). Over-map ambiguous (safe).
  // Persian — the 8 corpus tokens + common synonyms/species:
  'گلوتن': ['gluten_cereals', 'wheat'], 'گندم': ['wheat', 'gluten_cereals'], 'جو': ['gluten_cereals'], 'ارد': ['gluten_cereals', 'wheat'], 'نان': ['gluten_cereals'],
  'لبنیات': ['milk'], 'شیر': ['milk'], 'پنیر': ['milk'], 'ماست': ['milk'], 'خامه': ['milk'], 'کره': ['milk'], 'لاکتوز': ['milk'],
  'تخم مرغ': ['eggs'], 'تخممرغ': ['eggs'],
  'اجیل': ['tree_nuts'], 'مغزها': ['tree_nuts'], 'مغز': ['tree_nuts'], 'گردو': ['tree_nuts'], 'بادام': ['tree_nuts'], 'پسته': ['tree_nuts'], 'فندق': ['tree_nuts'], 'خشکبار': ['tree_nuts'],
  'بادام زمینی': ['peanut'], 'بادوم زمینی': ['peanut'],
  'میگو': ['shellfish', 'crustaceans', 'molluscs'], 'صدف': ['shellfish', 'crustaceans', 'molluscs'], 'خرچنگ': ['crustaceans'], 'حلزون': ['molluscs'],
  'ماهی': ['fish'], 'تن': ['fish'], 'سالمون': ['fish'],
  'سویا': ['soy'], 'توفو': ['soy'],
  'کنجد': ['sesame'], 'ارده': ['sesame'], 'طحینی': ['sesame'],
  'خردل': ['mustard'], 'کرفس': ['celery'], 'لوپین': ['lupin'], 'سولفیت': ['sulphites'], 'سولفور': ['sulphites'],
  // Dutch — for the EU/Holland launch corpus:
  tarwe: ['wheat', 'gluten_cereals'], melk: ['milk'], kaas: ['milk'], zuivel: ['milk'], ei: ['eggs'], eieren: ['eggs'],
  noten: ['tree_nuts'], noot: ['tree_nuts'], walnoot: ['tree_nuts'], amandel: ['tree_nuts'], pinda: ['peanut'],
  schaaldieren: ['shellfish', 'crustaceans', 'molluscs'], garnaal: ['crustaceans'], vis: ['fish'], soja: ['soy'],
  sesam: ['sesame'], mosterd: ['mustard'], selderij: ['celery'],
};

/**
 * Light fold so a Persian/Dutch recipe token matches its alias key regardless of authoring variant: ZWNJ→space,
 * Arabic ي/ك/ة and آأإ folded to Persian, whitespace collapsed. English tokens (no such chars) are unaffected.
 * Deliberately NARROW (not the full classifier normalizeText) to avoid a cross-module dependency in the hard gate.
 */
function foldAllergenToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/‌/g, ' ') // ZWNJ → space (تخم‌مرغ → تخم مرغ)
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/[آأإ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

/** map any allergen token to its canonical form(s), preserving unknown tokens as-is (folded/lowercased). */
export function canonicalizeAllergens(tokens: Iterable<unknown>): string[] {
  const out = new Set<string>();
  for (const raw of tokens) {
    if (typeof raw !== 'string') continue;
    const t = foldAllergenToken(raw);
    if (!t) continue;
    const mapped = ALLERGEN_ALIASES[t];
    if (mapped) mapped.forEach((m) => out.add(m));
    else out.add(t);
  }
  return [...out].sort();
}

/**
 * SAFETY (advisor audit): which of a recipe's allergen tokens conflict with the user's declared allergies, by
 * CANONICAL EXACT match. Replaces the prior bidirectional-substring looseMatch, which ENTANGLED distinct
 * allergens — 'shellfish'.includes('fish') made a shellfish-allergy hide all FISH dishes (and vice-versa), and
 * 'peanuts'.includes('nut') made a tree-nut allergy hide PEANUT dishes. Canonicalizing BOTH sides through the
 * alias map (nut→tree_nuts, peanut↔peanuts, dairy→milk, egg→eggs, gluten→wheat/cereals, shellfish⊇crustaceans+
 * molluscs) then intersecting on EXACT tokens preserves every intended match + the safe over-warn umbrella while
 * removing the false entanglements. Returns the recipe's ORIGINAL tokens that conflict (for the wording).
 */
export function allergensConflict(recipeAllergens: Iterable<unknown>, profileAllergies: Iterable<unknown>): string[] {
  const profileCanon = new Set(canonicalizeAllergens(profileAllergies));
  if (profileCanon.size === 0) return [];
  const out = new Set<string>();
  for (const raw of recipeAllergens) {
    if (typeof raw !== 'string') continue;
    const a = raw.trim().toLowerCase();
    if (!a) continue;
    if (canonicalizeAllergens([a]).some((c) => profileCanon.has(c))) out.add(a);
  }
  return [...out];
}

/**
 * Flatten a dictionary ingredient's allergens (the canonical shape is {eu14,us9,other,mayContain})
 * into a clean, canonical token set for the HARD allergy filter. HARDENED: also reads the legacy bare-array
 * shape (["nuts"], ["dairy"]…) — previously these passed the `typeof object` guard but exposed none of the
 * keys, so the allergen was SILENTLY DROPPED (a real safety hole across ~300 records); and normalizes
 * non-canonical tokens (nuts→tree_nuts, dairy→milk, gluten→wheat+gluten_cereals, seafood→fish+shellfish).
 */
export function extractDictionaryAllergens(allergensJson: unknown): string[] {
  if (!allergensJson) return [];
  if (Array.isArray(allergensJson)) return canonicalizeAllergens(allergensJson); // legacy bare-array form
  if (typeof allergensJson !== 'object') return [];
  const collected: unknown[] = [];
  for (const key of ['eu14', 'us9', 'other', 'mayContain']) {
    const arr = (allergensJson as Record<string, unknown>)[key];
    if (Array.isArray(arr)) collected.push(...arr);
  }
  return canonicalizeAllergens(collected);
}

function parseMinutes(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const m = value.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function vocabCheck(value: unknown, vocab: string[]): VocabCheck {
  const v = typeof value === 'string' && value.trim() ? value.trim() : null;
  if (!v) return { value: null, normalized: null, canonical: true }; // absent is allowed (missing stays missing)
  const n = norm(v);
  return { value: v, normalized: n, canonical: vocab.includes(n) };
}

function categoryCheck(value: unknown, vocab?: string[]): CategoryCheck {
  const values = toStringArray(value);
  const nonCanonical = vocab ? values.filter((x) => !vocab.includes(norm(x))) : [];
  return { values, nonCanonical };
}

/**
 * Analyze a presented recipe (with `ingredients[].ingredient` dictionary join when resolved).
 * Pure — no DB. The service layer may add best-effort name-match suggestions for unresolved names.
 */
export function analyzeRecipeIntegrity(recipe: any): IntegrityReport {
  const ingredients: any[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const resolvedIngredients = ingredients.filter((i) => i?.ingredient || i?.ingredientId);
  const unresolved = ingredients.filter((i) => !i?.ingredient && !i?.ingredientId);
  const unresolvedNames = unresolved.map((i) => String(i?.name ?? '')).filter(Boolean);

  // derived allergens (informational) from the resolved dictionary entries
  const derived = new Set<string>();
  for (const i of resolvedIngredients) {
    for (const a of extractDictionaryAllergens(i?.ingredient?.allergens)) derived.add(a);
  }

  const prepMin = parseMinutes(recipe?.prepTime);
  const cookMin = parseMinutes(recipe?.cookingTime);
  const totalMin = parseMinutes(recipe?.totalTime);
  let consistent: boolean | null = null;
  let timingNote = 'insufficient timing data';
  if (totalMin != null && (prepMin != null || cookMin != null)) {
    const sum = (prepMin ?? 0) + (cookMin ?? 0);
    consistent = Math.abs(sum - totalMin) <= Math.max(5, totalMin * 0.2); // 20% or 5min tolerance
    timingNote = consistent ? 'prep+cook ≈ total' : `prep+cook (${sum}m) differs from total (${totalMin}m)`;
  }

  const servingsVal = typeof recipe?.servings === 'number' ? recipe.servings : null;
  const servingsSane = servingsVal == null ? true : servingsVal > 0 && servingsVal <= 100;

  const diet = vocabCheck(recipe?.diet, DIET_VOCAB);
  const mealType = vocabCheck(recipe?.mealType, MEALTYPE_VOCAB);
  const categories = categoryCheck(recipe?.categories);
  const occasion = categoryCheck(recipe?.occasion);

  const warnings: string[] = [];
  if (unresolvedNames.length) warnings.push(`${unresolvedNames.length} ingredient(s) unresolved against the dictionary`);
  if (!diet.canonical) warnings.push(`non-canonical diet value: ${diet.value}`);
  if (!mealType.canonical) warnings.push(`non-canonical mealType value: ${mealType.value}`);
  if (consistent === false) warnings.push('timing inconsistency (prep+cook vs total)');
  if (!servingsSane) warnings.push('implausible servings');

  const total = ingredients.length;
  const overallStatus: IntegrityReport['overallStatus'] = total === 0 ? 'incomplete' : warnings.length ? 'warnings' : 'ok';

  return {
    recipeId: String(recipe?.id ?? ''),
    ingredientResolution: {
      total,
      resolved: resolvedIngredients.length,
      unresolved: unresolved.length,
      unresolvedNames,
      coveragePct: total ? Math.round((resolvedIngredients.length / total) * 100) : 0,
    },
    derivedAllergens: { allergens: [...derived].sort(), source: 'resolved_ingredient_dictionary', informationalOnly: true },
    declaredAllergens: toStringArray(recipe?.allergens).map((a) => a.toLowerCase()),
    vocabulary: { diet, mealType, categories, occasion },
    timing: { prepMin, cookMin, totalMin, consistent, note: timingNote },
    servings: { value: servingsVal, sane: servingsSane },
    overallStatus,
    warnings,
  };
}
