/**
 * BACKFILL — per-serving Nutrition for Persian recipes that are missing it (DEV / local only).
 *
 * WHY: ~47% of published Persian recipes had a Nutrition row with NULL macros, so the meal-plan's
 * accuracy-gated per-day line («≈ N کالری · پروتئین Mg», apps/web/.../plan/page.jsx) — which renders
 * ONLY when EVERY filled dish that day has nutrition — stayed hidden for Persian-heavy plans. Intl recipes
 * are ~100% populated; this closes the Persian gap.
 *
 * HOW (deterministic + grounded — NO fabrication):
 *   per-serving macro = Σ( GRIS.weightG × dictionary.nutritionPer100g / 100 ) / recipe.servings
 *   — the SAME formula the live POST /recipes/:id/personalize engine uses (sumNutrition in
 *     apps/server/src/recipes/intelligence/recipe-personalize.ts). GRIS weightG is the only grounded
 *     gram source (the dictionary has per-100g but NO unit→gram data, and RecipeIngredient.amount is in
 *     tsp/tbsp/cup/piece — converting those would be guesswork). So we compute strictly from authored grams.
 *   Each GRIS ingredient resolves to a dictionary id via: gi.ingredientId → the «— ing_xxx» name suffix →
 *     a normalized name-match to the recipe's linked RecipeIngredient rows.
 *
 * HONESTY GATE (a recipe is written ONLY when the number is trustworthy):
 *   - every GRIS ingredient that does NOT contribute (missing weightG or per-100g) must be NEGLIGIBLE —
 *     a to-taste salt/spice/herb (≤5 kcal/100g, or a spice category/keyword, or «به مزه/به مقدار لازم»,
 *     or optional). If a REAL-calorie ingredient (oil, bread, flour, meat…) lacks a weight, the dish is
 *     SKIPPED (we will not under/over-count). This is what excludes deep-fried dishes whose frying-oil
 *     weight is unknown (counting the whole bath over-counts; omitting it under-counts).
 *   - ≥ 3 ingredients must resolve, servings must be > 0, and the result must be plausible
 *     (MIN_KCAL..MAX_KCAL per serving) — catches artifacts like a full oil bath counted into one serving.
 *
 * SAFETY:
 *   - local `garnish_db` ONLY (hard stop otherwise).
 *   - DRY-RUN by default; writes only with `--apply`.
 *   - Idempotent + non-destructive: UPDATE ... WHERE calories IS NULL — never overwrites an existing value,
 *     so re-runs are safe and the 88 already-populated Persian + 150 intl rows are untouched.
 *   - Touches ONLY the Nutrition table. Does NOT read or change allergens/dietFlags/visibility/the safety
 *     filter — zero interaction with the allergy gate or recipe-visibility.
 *   - Rows are stamped source='estimated_ingredient_gris_v1' (ESTIMATED until USDA source-locked).
 *
 * RUN:
 *   node --env-file=.env scripts/data/backfill-persian-nutrition.cjs            # dry-run (prints the plan)
 *   node --env-file=.env scripts/data/backfill-persian-nutrition.cjs --apply    # writes
 *   node --env-file=.env scripts/data/backfill-persian-nutrition.cjs --verify   # just print current coverage
 */
const { PrismaClient } = require('@prisma/client');

const SOURCE_TAG = 'estimated_ingredient_gris_v1';
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
 * Compute one recipe → { writable, perServing, macros, resolved, blockers, perServingCalories } following the gate.
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

async function loadCandidates(prisma) {
  const recipes = await prisma.recipe.findMany({
    where: { status: 'active', isPublic: true },
    select: {
      id: true, title: true, region: true, servings: true, gris: true,
      nutrition: { select: { calories: true } },
      ingredients: { select: { name: true, ingredientId: true } },
    },
  });
  const persian = recipes.filter(isPersian);
  const have = persian.filter((r) => r.nutrition && r.nutrition.calories != null).length;
  const missing = persian.filter((r) => !(r.nutrition && r.nutrition.calories != null));
  return { persianTotal: persian.length, have, missing };
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
    const { persianTotal, have, missing } = await loadCandidates(prisma);
    const pct = (n) => `${n}/${persianTotal} (${Math.round((n / persianTotal) * 100)}%)`;
    console.log(`[coverage] Persian published with nutrition BEFORE: ${pct(have)} | missing: ${missing.length}`);
    if (verifyOnly) return;

    const D = await dictFor(prisma, missing);
    const writable = []; const skipped = { no_gris: [], blocked: [], implausible: [], other: [] };
    for (const r of missing) {
      const res = computeRecipe(r, D);
      if (res.writable) writable.push({ id: r.id, title: r.title, servings: r.servings, ...res });
      else if (res.skip === 'no_gris') skipped.no_gris.push(r.title);
      else if (res.skip === 'blocked') skipped.blocked.push(`${r.title} → ${res.blockers.join(' ; ')}`);
      else if (res.skip === 'implausible') skipped.implausible.push(`${r.title} (${res.perServingCalories}/serv)`);
      else skipped.other.push(`${r.title} (${res.skip})`);
    }

    console.log(`\n[plan] WRITABLE: ${writable.length} | skipped: no_gris=${skipped.no_gris.length} blocked=${skipped.blocked.length} implausible=${skipped.implausible.length} other=${skipped.other.length} | mode=${apply ? 'APPLY' : 'dry-run'}`);
    console.log('\n[writable] (kcal/serv · P/C/F/fiber g)');
    for (const w of writable.sort((a, b) => a.macros.calories - b.macros.calories)) {
      console.log(`  ${String(Math.round(w.macros.calories)).padStart(4)}  P${String(w.macros.protein).padStart(5)} C${String(w.macros.carbs).padStart(5)} F${String(w.macros.fat).padStart(5)} fib${String(w.macros.fiber).padStart(4)}  ${w.title}  (${w.resolved}ing/${w.servings}serv)`);
    }
    if (skipped.blocked.length) { console.log('\n[skip:blocked — a real-calorie ingredient lacks a weight, so the number would be wrong]'); for (const s of skipped.blocked) console.log('   • ' + s); }
    if (skipped.implausible.length) { console.log('\n[skip:implausible — out of plausible per-serving range]'); for (const s of skipped.implausible) console.log('   • ' + s); }
    if (skipped.no_gris.length) console.log(`\n[skip:no_gris — needs GRIS authoring before it can be computed] ${skipped.no_gris.join(' · ')}`);

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
          w.macros.calories, w.macros.protein, w.macros.carbs, w.macros.fat, w.macros.fiber, SOURCE_TAG, w.id,
        );
        updated += res;
      }
      const afterNonNull = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM "Nutrition" n JOIN "Recipe" r ON r.id = n."recipeId" WHERE n.calories IS NOT NULL');
      const delta = afterNonNull[0].c - beforeNonNull[0].c;
      if (delta !== updated) throw new Error(`SAFETY: non-null nutrition delta ${delta} != rows updated ${updated} — rolling back`);
    }, { timeout: 120000, maxWait: 30000 });

    console.log(`\n[apply] Nutrition rows filled: ${updated} (source='${SOURCE_TAG}')`);
    const after = await loadCandidates(prisma);
    console.log(`[coverage] Persian published with nutrition AFTER: ${after.have}/${after.persianTotal} (${Math.round((after.have / after.persianTotal) * 100)}%) | still missing: ${after.missing.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('BACKFILL ERROR:', e.message); process.exit(1); });
