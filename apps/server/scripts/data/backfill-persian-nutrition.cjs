/**
 * BACKFILL — per-serving Nutrition for Persian recipes that are missing it (DEV / local only).
 *
 * WHY: ~47% of published Persian recipes had a Nutrition row with NULL macros, so the meal-plan's
 * accuracy-gated per-day line («≈ N کالری · پروتئین Mg», apps/web/.../plan/page.jsx) — which renders
 * ONLY when EVERY filled dish that day has nutrition — stayed hidden for Persian-heavy plans. Intl recipes
 * are ~100% populated; this closes the Persian gap.
 *
 * TWO TIERS (both deterministic + grounded — NO fabrication; each row carries an honest `source`):
 *
 *   TIER 1 — GRIS-grounded (source='estimated_ingredient_gris_v1'):
 *     per-serving macro = Σ( GRIS.weightG × dictionary.nutritionPer100g / 100 ) / recipe.servings
 *     — the SAME formula the live POST /recipes/:id/personalize engine uses (sumNutrition in
 *       apps/server/src/recipes/intelligence/recipe-personalize.ts). GRIS weightG is the strongest grounded
 *       gram source. Each GRIS ingredient resolves to a dictionary id via gi.ingredientId → the «— ing_xxx»
 *       name suffix → a normalized name-match to the recipe's linked RecipeIngredient rows.
 *
 *   TIER 2 — amount-imputed gap-filler (source='estimated_imputed_grams_v1'), for recipes Tier 1 can't ground
 *     (no GRIS, or a real-calorie GRIS ingredient lacks weightG — typically the frying oil). It is a GAP-FILLER:
 *     for each ingredient it PREFERS the authored GRIS weightG, and only where that is absent it imputes grams
 *     from the recipe's OWN authored RecipeIngredient.amount × a unit→gram factor MINED from the corpus
 *     (median grams-per-unit learned from every recipe that already pairs a GRIS weightG with an amount+unit,
 *     e.g. «۱ عدد پیاز» ≈ 110 g, «۱ قاشق غذاخوری» ≈ 13.7 g). Two calibrated assumptions, both documented inline:
 *       • DEEP-FRY OIL: the discarded frying bath is NEVER counted; absorbed oil is modeled at FRY_OIL_UPTAKE
 *         (≈10% of the fried food's weight — literature range 8–12%). This is what turns the مرغ سوخاری artifact
 *         (1921 kcal/serv = whole bath) into a realistic ~700.
 *       • UNQUANTIFIED «به مقدار لازم» ingredient: dropped as a minor garnish ONLY if it's plausibly tiny
 *         (spice/herb/beverage, or ≤60 kcal/100g, or a named condiment like ketchup/mustard). A dense
 *         unquantified main (sausage, ham, canned corn) BLOCKS the estimate instead — we will not invent a
 *         portion for a real contributor.
 *
 * HONESTY GATE (identical for both tiers — a recipe is written ONLY when the number is trustworthy):
 *   - every ingredient that does NOT contribute must be NEGLIGIBLE (a to-taste salt/spice/herb/leavening,
 *     ≤5 kcal/100g, a spice/salt category, a known seasoning keyword, or a droppable «به مقدار لازم» garnish).
 *     If a REAL-calorie ingredient lacks a weight/conversion, the dish is SKIPPED (we will not under/over-count).
 *   - ≥ MIN_RESOLVED ingredients must resolve, servings must be > 0, and the per-serving result must be
 *     plausible (MIN_KCAL..MAX_KCAL) — catches artifacts like a full oil bath counted into one serving.
 *
 * SAFETY:
 *   - local `garnish_db` ONLY (hard stop otherwise).
 *   - DRY-RUN by default; writes only with `--apply`.
 *   - Idempotent + non-destructive: UPDATE ... WHERE calories IS NULL — never overwrites an existing value,
 *     so re-runs are safe and already-populated rows are untouched.
 *   - Touches ONLY the Nutrition table. Does NOT read or change allergens/dietFlags/visibility/the safety
 *     filter, and does NOT mutate the gris column — zero interaction with the allergy gate or recipe-visibility.
 *   - Rows are stamped with their tier's source (ESTIMATED until USDA source-locked).
 *
 * RUN:
 *   node --env-file=.env scripts/data/backfill-persian-nutrition.cjs            # dry-run (prints the plan)
 *   node --env-file=.env scripts/data/backfill-persian-nutrition.cjs --apply    # writes
 *   node --env-file=.env scripts/data/backfill-persian-nutrition.cjs --verify   # just print current coverage
 */
const { PrismaClient } = require('@prisma/client');

const SOURCE_TAG = 'estimated_ingredient_gris_v1';          // Tier 1
const SOURCE_TAG_IMPUTED = 'estimated_imputed_grams_v1';    // Tier 2
const MIN_RESOLVED = 3;     // need a real ingredient base, not 1-2 odds and ends
const MIN_KCAL = 20;        // below this per serving is almost always a data artifact (e.g. only spices resolved)
const MAX_KCAL = 1500;      // above this is almost always an artifact (e.g. a full frying-oil bath in one serving)

const MACROS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
const isPersian = (r) => /persian|iran|ایران/i.test(r.region || '');
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);

// GRIS names may embed the dictionary id, e.g. «گوشت گوسفند — ing_lamb_meat_raw».
const GRIS_ID = /\s*[—–-]\s*(ing_[a-z0-9_]+)\s*$/i;
const parseId = (n) => { const m = String(n ?? '').match(GRIS_ID); return m ? m[1] : null; };
const grisIngs = (g) => { if (!g || typeof g !== 'object') return null; const c = g.ingredients || g.recipe?.ingredients; return Array.isArray(c) ? c : null; };
const weightOf = (i) => { const w = i.weightG ?? i.weight_g ?? i.grams; return (typeof w === 'number' && Number.isFinite(w) && w > 0) ? w : null; };
// normalize a Persian ingredient name for matching (strip ZWNJ/space/punctuation + unify ی/ي ک/ك آ/ا).
const norm = (s) => String(s ?? '').replace(GRIS_ID, '').replace(/[‌\s().،,/]/g, '').replace(/[آأإ]/g, 'ا').replace(/ی/g, 'ي').replace(/ک/g, 'ك').trim();

// "this ingredient may be omitted from the calorie sum without making the number wrong" — to-taste salt/spice/herb.
const TOTASTE = /به\s*مزه|به\s*مقدار\s*لازم|به\s*دلخواه|اختیار|optional|نوک\s*قاشق/;
const NEG_CAT = new Set(['spice', 'salt', 'herb', 'seasoning', 'leavening', 'condiment']);
const NEG_NAME = /نمک|فلفل|زردچوبه|زعفران|دارچین|هل\b|نعناع خشک|پاپریکا|زنجبیل|آویشن|سماق/;

function r1(x) { return Math.round(x * 10) / 10; }

/**
 * TIER 1 — compute one recipe → { writable, macros, resolved } | { skip, ... } strictly from GRIS weightG.
 * `D` is a Map<ingredientId, {nutritionPer100g, category}>.
 */
function computeRecipe(recipe, D) {
  const g = grisIngs(recipe.gris);
  if (!g || !g.length) return { skip: 'no_gris' };
  const riByNorm = new Map((recipe.ingredients || []).map((ri) => [norm(ri.name), ri]));
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let resolved = 0;
  const blockers = [];

  for (const gi of g) {
    let id = gi.ingredientId || parseId(gi.name);
    if (!id) {
      let ri = riByNorm.get(norm(gi.name));
      if (!ri) { const n = norm(gi.name); for (const [k, v] of riByNorm) { if (k && n && (k.includes(n) || n.includes(k))) { ri = v; break; } } }
      id = ri?.ingredientId || null;
    }
    const d = id ? D.get(id) : null;
    const p = d && d.nutritionPer100g && typeof d.nutritionPer100g === 'object' ? d.nutritionPer100g : null;
    const w = weightOf(gi);

    if (w != null && p) {
      resolved += 1;
      for (const m of MACROS) { const v = Number(p[m]); if (Number.isFinite(v)) total[m] += (v * w) / 100; }
      continue;
    }
    // not contributing → must be negligible, else it blocks the whole recipe
    const volTxt = `${gi.volume || ''} ${gi.prepState || ''} ${gi.role || ''}`;
    const cat = d?.category;
    const kcal100 = p ? Number(p.calories) : null;
    const negligible =
      gi.optional === true || TOTASTE.test(volTxt) || (cat && NEG_CAT.has(cat)) ||
      (kcal100 != null && kcal100 <= 5) || NEG_NAME.test(gi.name || '');
    if (!negligible) blockers.push(`${String(gi.name || '?').replace(GRIS_ID, '').trim()} [w=${w ?? '∅'} cat=${cat || '?'} kcal100=${kcal100 ?? '?'}]`);
  }

  if (blockers.length) return { skip: 'blocked', blockers };
  if (resolved < MIN_RESOLVED) return { skip: `only_${resolved}_resolved` };
  const sv = recipe.servings && recipe.servings > 0 ? recipe.servings : null;
  if (!sv) return { skip: 'no_servings' };

  const macros = Object.fromEntries(MACROS.map((m) => [m, r1(total[m] / sv)]));
  const perServingCalories = macros.calories;
  if (perServingCalories < MIN_KCAL || perServingCalories > MAX_KCAL) return { skip: 'implausible', perServingCalories };
  return { writable: true, macros, resolved };
}

// ---------------------------------------------------------------------------------------------------------
// TIER 2 — amount-imputed gap-filler (when GRIS weightG is absent). Documented, calibrated, still gated.
// ---------------------------------------------------------------------------------------------------------

const FRY_OIL_UPTAKE = 0.10;   // deep-fry oil absorbed ≈ 10% of the fried food's weight (lit. 8–12%); the discarded bath is NOT counted.
const FRY_OIL_BATH_G = 60;     // an authored oil amount ≥ this (≈¼ cup) is a frying bath → model uptake instead of counting it.
const FRY_TITLE = /سوخاری|سرخ.?کرده|فلافل|سمبوسه|چیپس|پیراشکی|ناگت/;
const OIL_IDS = new Set(['ing_sunflower_oil', 'ing_vegetable_oil', 'ing_olive_oil', 'ing_canola_oil', 'ing_corn_oil']);
const isOilId = (id) => OIL_IDS.has(id) || /_oil$/.test(id || '');
// documented cooking-oil density (≈0.91 g/ml): oil is high-calorie, so we use a real density rather than the mixed mined median.
const OIL_GRAMS_PER_UNIT = { 'پیمانه': 218, 'قاشق غذاخوری': 13.6, 'قاشق چای‌خوری': 4.5, 'میلی‌لیتر': 0.91, 'لیتر': 910, 'گرم': 1 };
// an unquantified amount: «به مقدار لازم / به مزه / به دلخواه / به اندازه» (or a missing numeric amount).
const ASNEEDED_UNIT = /به\s*مقدار\s*لازم|به\s*مزه|به\s*دلخواه|به\s*اندازه/;
const NEG_CAT2 = new Set(['spice', 'salt', 'herb', 'seasoning', 'leavening']);
const NEG_NAME2 = /نمک|فلفل سیاه|فلفل قرمز|پرک فلفل|زردچوبه|زعفران|دارچین|هل\b|نعناع|پاپریکا|زنجبیل|آویشن|سماق|زیره|وانیل|جوش شیرین|بکینگ|گلاب|بهارنارنج|جوز هندی|ادویه/;
const CONDIMENT_NAME = /کچاپ|خردل/;   // tiny-quantity squirts even at >60 kcal/100g
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Learn unit→gram factors from every corpus recipe that pairs a GRIS weightG with an amount+unit for the same id. */
function mineConversions(allRecipes) {
  const perIngUnit = new Map();   // `${ingredientId}|${unit}` → [gramsPerUnit…]
  const perUnit = new Map();      // `${unit}`               → [gramsPerUnit…]  (global fallback)
  for (const r of allRecipes) {
    const g = grisIngs(r.gris); if (!g) continue;
    const wById = new Map();
    for (const gi of g) { const id = gi.ingredientId || parseId(gi.name); const w = weightOf(gi); if (id && w != null && !wById.has(id)) wById.set(id, w); }
    for (const ri of (r.ingredients || [])) {
      if (!ri.ingredientId || ri.amount == null || !ri.unit || !(ri.amount > 0)) continue;
      const w = wById.get(ri.ingredientId); if (w == null) continue;
      const gpu = w / ri.amount;
      push(perIngUnit, `${ri.ingredientId}|${ri.unit}`, gpu);
      push(perUnit, ri.unit, gpu);
    }
  }
  return {
    tIU: new Map([...perIngUnit].map(([k, v]) => [k, median(v)])),
    tU: new Map([...perUnit].map(([k, v]) => [k, median(v)])),
  };
}

/** grams for an oil ingredient from its authored amount, via documented oil density. */
function gramsForOil(ri) {
  if (ri.amount == null || !ri.unit || !(ri.amount > 0)) return null;
  const d = OIL_GRAMS_PER_UNIT[ri.unit];
  return d != null ? d * ri.amount : null;
}

/** grams for a non-oil ingredient from its authored amount, via the mined (ingredient,unit) → global-unit table. */
function imputeGrams(ri, conv) {
  if (ri.amount == null || !ri.unit || !(ri.amount > 0)) return null;
  const gpu = conv.tIU.get(`${ri.ingredientId}|${ri.unit}`) ?? conv.tU.get(ri.unit) ?? null;
  return gpu != null ? gpu * ri.amount : null;
}

/** a quantified ingredient whose omission cannot change the number meaningfully — to-taste salt/spice/herb. */
function negligible2(ri, d, p) {
  const kcal = p ? Number(p.calories) : null;
  if (kcal != null && kcal <= 5) return true;             // salt, water
  if (d && NEG_CAT2.has(d.category)) return true;          // any spice / salt / herb / leavening / seasoning
  if (NEG_NAME2.test(ri.name || '')) return true;
  return false;
}

/** an UNQUANTIFIED «به مقدار لازم» ingredient we may drop as a minor garnish (else it blocks). */
function asNeededDroppable(ri, d, p) {
  const kcal = p ? Number(p.calories) : null;
  const cat = d?.category;
  if (cat && ['spice', 'herb', 'salt', 'seasoning', 'beverage'].includes(cat)) return true;
  if (kcal != null && kcal <= 60) return true;             // genuinely low-cal veg/fruit garnish
  if (CONDIMENT_NAME.test(ri.name || '')) return true;     // ketchup / mustard squirt
  return false;
}

/**
 * TIER 2 — compute one recipe → { writable, macros, resolved } | { skip, ... } by imputing grams from the
 * recipe's authored amounts, preferring any authored GRIS weightG, with the deep-fry-oil + as-needed models.
 */
function computeImputed(recipe, D, conv) {
  const ris = recipe.ingredients || [];
  if (!ris.length) return { skip: 'no_ingredients' };
  // strongest grounding first: authored GRIS weightG per ingredient id (we only impute the gaps).
  const grisW = new Map();
  for (const gi of (grisIngs(recipe.gris) || [])) {
    const id = gi.ingredientId || parseId(gi.name); const w = weightOf(gi);
    if (id && w != null && !grisW.has(id)) grisW.set(id, w);
  }
  const isFryTitle = FRY_TITLE.test(recipe.title || '');
  const items = [];          // { p, g } contributing ingredients
  const blockers = [];
  let oil = null;            // { p, authoredG } — resolved after we know the solids total
  let solids = 0;

  for (const ri of ris) {
    const id = ri.ingredientId;
    const d = id ? D.get(id) : null;
    const p = d && d.nutritionPer100g && typeof d.nutritionPer100g === 'object' ? d.nutritionPer100g : null;
    const asNeeded = ASNEEDED_UNIT.test(ri.unit || '') || ri.amount == null;

    if (isOilId(id)) { if (p) oil = { p, authoredG: grisW.get(id) ?? gramsForOil(ri) }; continue; }
    if (negligible2(ri, d, p)) continue;                  // to-taste aromatic → ignore, doesn't block
    if (!p) { if (asNeeded && asNeededDroppable(ri, d, null)) continue; blockers.push(`${ri.name} [no per100g]`); continue; }
    if (asNeeded) {
      if (asNeededDroppable(ri, d, p)) continue;          // minor unquantified garnish → drop
      blockers.push(`${String(ri.name || '?').trim()} [unquantified «${String(ri.unit || '').trim()}», ${Number(p.calories)}kcal/100g]`);
      continue;
    }
    const g = grisW.get(id) ?? imputeGrams(ri, conv);     // prefer authored grams, else mined conversion
    if (g == null || !(g > 0)) { blockers.push(`${String(ri.name || '?').trim()} [no gram conversion for unit «${String(ri.unit || '').trim()}»]`); continue; }
    items.push({ p, g }); solids += g;
  }

  // oil model:
  //   • deep-fry (title says so): the bath is discarded → count only absorbed oil (uptake × fried food weight).
  //   • large shallow bath (≥¼ cup) but not deep-fry (e.g. an eggplant stew): oil is mostly retained in the dish,
  //     but you can never absorb/retain MORE than was used → min(uptake estimate, authored bath). This stops the
  //     uptake model from over-counting when only part of the food is fried (the stewed meat isn't in the oil).
  //   • small amount of oil (<¼ cup, a sauté/dressing): all of it is consumed → count the authored amount.
  if (oil && oil.p) {
    let og;
    if (isFryTitle) og = FRY_OIL_UPTAKE * solids;
    else if (oil.authoredG != null && oil.authoredG >= FRY_OIL_BATH_G) og = Math.min(FRY_OIL_UPTAKE * solids, oil.authoredG);
    else og = oil.authoredG;
    if (og != null && og > 0) items.push({ p: oil.p, g: og });
  }

  if (blockers.length) return { skip: 'blocked', blockers };
  const resolved = items.length;
  if (resolved < MIN_RESOLVED) return { skip: `only_${resolved}_resolved` };
  const sv = recipe.servings && recipe.servings > 0 ? recipe.servings : null;
  if (!sv) return { skip: 'no_servings' };

  const total = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const it of items) for (const m of MACROS) { const v = Number(it.p[m]); if (Number.isFinite(v)) total[m] += (v * it.g) / 100; }
  const macros = Object.fromEntries(MACROS.map((m) => [m, r1(total[m] / sv)]));
  if (macros.calories < MIN_KCAL || macros.calories > MAX_KCAL) return { skip: 'implausible', perServingCalories: macros.calories };
  return { writable: true, macros, resolved };
}

async function loadCandidates(prisma) {
  const recipes = await prisma.recipe.findMany({
    where: { status: 'active', isPublic: true },
    select: {
      id: true, title: true, region: true, servings: true, gris: true,
      nutrition: { select: { calories: true } },
      ingredients: { select: { name: true, ingredientId: true, amount: true, unit: true } },
    },
  });
  const persian = recipes.filter(isPersian);
  const have = persian.filter((r) => r.nutrition && r.nutrition.calories != null).length;
  const missing = persian.filter((r) => !(r.nutrition && r.nutrition.calories != null));
  return { all: recipes, persianTotal: persian.length, have, missing };
}

async function dictFor(prisma, missing) {
  const ids = new Set();
  for (const r of missing) {
    for (const ri of (r.ingredients || [])) if (ri.ingredientId) ids.add(ri.ingredientId);
    for (const gi of (grisIngs(r.gris) || [])) { if (gi.ingredientId) ids.add(gi.ingredientId); const p = parseId(gi.name); if (p) ids.add(p); }
  }
  const dict = await prisma.ingredient.findMany({ where: { id: { in: [...ids] } }, select: { id: true, nutritionPer100g: true, category: true } });
  return new Map(dict.map((d) => [d.id, d]));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(dbUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error(`SAFETY STOP: expected local garnish_db, got ${dbName}@${parsed.hostname}`);

  const prisma = new PrismaClient();
  try {
    const { all, persianTotal, have, missing } = await loadCandidates(prisma);
    const pct = (n) => `${n}/${persianTotal} (${Math.round((n / persianTotal) * 100)}%)`;
    console.log(`[coverage] Persian published with nutrition BEFORE: ${pct(have)} | missing: ${missing.length}`);
    if (verifyOnly) return;

    const D = await dictFor(prisma, missing);
    const conv = mineConversions(all);

    const writable = []; const skipped = { no_gris: [], blocked: [], implausible: [], other: [] };
    for (const r of missing) {
      // Tier 1 first (strongest grounding); fall back to Tier 2 (amount-imputed) only if Tier 1 can't write it.
      let res = computeRecipe(r, D);
      let source = SOURCE_TAG;
      if (!res.writable) {
        const t2 = computeImputed(r, D, conv);
        if (t2.writable) { res = t2; source = SOURCE_TAG_IMPUTED; }
        else res = pickWorseSkip(res, t2);  // report the most informative skip reason
      }
      if (res.writable) writable.push({ id: r.id, title: r.title, servings: r.servings, source, ...res });
      else if (res.skip === 'no_gris' || res.skip === 'no_ingredients') skipped.no_gris.push(r.title);
      else if (res.skip === 'blocked') skipped.blocked.push(`${r.title} → ${res.blockers.join(' ; ')}`);
      else if (res.skip === 'implausible') skipped.implausible.push(`${r.title} (${res.perServingCalories}/serv)`);
      else skipped.other.push(`${r.title} (${res.skip})`);
    }

    const t1 = writable.filter((w) => w.source === SOURCE_TAG).length;
    const t2 = writable.filter((w) => w.source === SOURCE_TAG_IMPUTED).length;
    console.log(`\n[plan] WRITABLE: ${writable.length} (tier1_gris=${t1} tier2_imputed=${t2}) | skipped: no_gris=${skipped.no_gris.length} blocked=${skipped.blocked.length} implausible=${skipped.implausible.length} other=${skipped.other.length} | mode=${apply ? 'APPLY' : 'dry-run'}`);
    console.log('\n[writable] (kcal/serv · P/C/F/fiber g · tier)');
    for (const w of writable.sort((a, b) => a.macros.calories - b.macros.calories)) {
      const tier = w.source === SOURCE_TAG_IMPUTED ? 'T2' : 'T1';
      console.log(`  ${String(Math.round(w.macros.calories)).padStart(4)}  P${String(w.macros.protein).padStart(5)} C${String(w.macros.carbs).padStart(5)} F${String(w.macros.fat).padStart(5)} fib${String(w.macros.fiber).padStart(4)}  [${tier}] ${w.title}  (${w.resolved}ing/${w.servings}serv)`);
    }
    if (skipped.blocked.length) { console.log('\n[skip:blocked — a real-calorie ingredient lacks a weight/conversion, so the number would be wrong]'); for (const s of skipped.blocked) console.log('   • ' + s); }
    if (skipped.implausible.length) { console.log('\n[skip:implausible — out of plausible per-serving range]'); for (const s of skipped.implausible) console.log('   • ' + s); }
    if (skipped.no_gris.length) console.log(`\n[skip:no_gris — no GRIS and no convertible amounts] ${skipped.no_gris.join(' · ')}`);
    if (skipped.other.length) { console.log('\n[skip:other]'); for (const s of skipped.other) console.log('   • ' + s); }

    if (!apply) { console.log('\n[dry-run] no writes. Re-run with --apply.'); return; }

    // Ensure the provenance column exists (idempotent; mirrors the migration so the script is self-contained
    // even if `prisma migrate deploy` has not been run in this env yet).
    await prisma.$executeRawUnsafe('ALTER TABLE "Nutrition" ADD COLUMN IF NOT EXISTS "source" TEXT');

    let updated = 0;
    await prisma.$transaction(async (tx) => {
      // safety: count Persian rows that already carry real calories — must be unchanged by us.
      const beforeNonNull = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM "Nutrition" n JOIN "Recipe" r ON r.id = n."recipeId" WHERE n.calories IS NOT NULL');
      for (const w of writable) {
        // guarded UPDATE: only a NULL-calorie row is ever filled → never overwrites real data; re-run-safe.
        const res = await tx.$executeRawUnsafe(
          'UPDATE "Nutrition" SET calories = $1, protein = $2, carbs = $3, fat = $4, fiber = $5, source = $6 WHERE "recipeId" = $7 AND calories IS NULL',
          w.macros.calories, w.macros.protein, w.macros.carbs, w.macros.fat, w.macros.fiber, w.source, w.id,
        );
        updated += res;
      }
      const afterNonNull = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM "Nutrition" n JOIN "Recipe" r ON r.id = n."recipeId" WHERE n.calories IS NOT NULL');
      const delta = afterNonNull[0].c - beforeNonNull[0].c;
      if (delta !== updated) throw new Error(`SAFETY: non-null nutrition delta ${delta} != rows updated ${updated} — rolling back`);
    }, { timeout: 120000, maxWait: 30000 });

    console.log(`\n[apply] Nutrition rows filled: ${updated} (tier1='${SOURCE_TAG}', tier2='${SOURCE_TAG_IMPUTED}')`);
    const after = await loadCandidates(prisma);
    console.log(`[coverage] Persian published with nutrition AFTER: ${after.have}/${after.persianTotal} (${Math.round((after.have / after.persianTotal) * 100)}%) | still missing: ${after.missing.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

// keep the more actionable skip reason between Tier 1 and Tier 2 (a concrete blocker beats a bare "no_gris").
function pickWorseSkip(t1, t2) {
  const rank = (s) => (s.skip === 'blocked' ? 3 : s.skip === 'implausible' ? 2 : (s.skip === 'no_gris' || s.skip === 'no_ingredients') ? 0 : 1);
  return rank(t2) >= rank(t1) ? t2 : t1;
}

main().catch((e) => { console.error('BACKFILL ERROR:', e.message); process.exit(1); });
