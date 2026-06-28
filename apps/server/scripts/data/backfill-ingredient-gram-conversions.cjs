/**
 * BACKFILL — Ingredient.gramConversions (the amount→gram connector). DEV / local only.
 *
 * WHY: the engine has source-locked per-100g nutrition for ~100% of recipe-used ingredients, and recipe
 * ingredients are 100% linked to the dictionary with 99% parseable amounts — but only 22% of amounts are in
 * grams, so the live engine could fully ground only ~10 of 350 dishes and `compute_nutrition` was a non-starter.
 * This populates, per ingredient, the grams for each NON-mass unit the corpus actually uses («عدد»، «پیمانه»،
 * «قاشق غذاخوری»، «حبه» …) so the engine can convert «۲ عدد پیاز»/«۱ پیمانه برنج» → grams → a whole-dish total.
 *
 * TWO SOURCES (both deterministic, NO fabrication; every entry carries its own `src` + sample count):
 *
 *   A) CORPUS-MINED (src='mined'): grams-per-unit = median over every recipe that pairs a GRIS weightG with an
 *      authored amount+unit for the SAME ingredient (weightG ÷ amount). Per-(ingredient,unit) preferred; needs
 *      ≥ MIN_N samples and must fall inside a documented sanity band for that unit (rejects artifacts).
 *
 *   B) DOCUMENTED REFERENCE (src='curated'): standard culinary gram weights (USDA FoodData Central portion
 *      data / King-Arthur flour weights / standard references) for the cases a generic factor gets WRONG —
 *      «۱ پیمانه آرد»≈۱۲۰g ≠ «۱ پیمانه برنج»≈۱۸۰g, «۱ عدد نان پیتا»≈۶۰g ≠ «۱ عدد پیتزا‌خمیر»≈۲۵۰g. Curated WINS
 *      over a mined value (it also corrects a bad mine, e.g. flour mined to a spurious 30 g/cup).
 *
 * Stored shape (per ingredient): { perUnit: { «عدد»: {g, src, n?}, … }, densityGPerMl?, source }. Only GROUNDED
 * units land in perUnit; generic per-unit medians stay in code (ingredient-grams.GLOBAL_UNIT_GRAMS) and the
 * compute layer trusts them ONLY for low-calorie ingredients. ESTIMATED until USDA portion-locked.
 *
 * SAFETY: local `garnish_db` ONLY (hard stop); DRY-RUN by default (`--apply` writes, `--verify` prints
 * coverage); touches ONLY the new `gramConversions` column (never nutrition, allergens, dietFlags, visibility,
 * or the gris/Nutrition tables); idempotent (the value is a pure function of corpus+reference — a re-run refreshes).
 *
 * RUN:
 *   node --env-file=.env scripts/data/backfill-ingredient-gram-conversions.cjs            # dry-run (plan + coverage)
 *   node --env-file=.env scripts/data/backfill-ingredient-gram-conversions.cjs --apply    # writes gramConversions
 *   node --env-file=.env scripts/data/backfill-ingredient-gram-conversions.cjs --verify   # current coverage only
 */
const { PrismaClient } = require('@prisma/client');

const SOURCE_TAG = 'estimated_gram_conversions_v1';
const MIN_N = 2; // a per-(ingredient,unit) median needs ≥2 corpus observations to be trusted
const GLOBAL_TRUST_KCAL = 50; // the compute gate trusts a generic (global) piece/cup weight only ≤ this kcal/100g
const MIN_RESOLVED = 3, MIN_KCAL = 20, MAX_KCAL = 2000; // dish plausibility (mirrors dish-nutrition.ts)

const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
const GRIS_ID = /\s*[—–-]\s*(ing_[a-z0-9_]+)\s*$/i;
const parseId = (n) => { const m = String(n ?? '').match(GRIS_ID); return m ? m[1] : null; };
const grisIngs = (g) => { if (!g || typeof g !== 'object') return null; const c = g.ingredients || g.recipe?.ingredients; return Array.isArray(c) ? c : null; };
const weightOf = (i) => { const w = i.weightG ?? i.weight_g ?? i.grams; return (typeof w === 'number' && Number.isFinite(w) && w > 0) ? w : null; };
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ── amount parsing + unit normalisation (kept in sync with src/recipes/intelligence/ingredient-grams.ts) ──
const FA = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const VULGAR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅙': 1 / 6, '⅚': 5 / 6 };
function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[۰-۹٠-٩]/g, (d) => FA[d] ?? d);
  if (!s) return null;
  const half = /(^|\s|‌)نیم(\s|$|‌)/.test(s);
  let t = 0, matched = false;
  for (const [g, v] of Object.entries(VULGAR)) if (s.includes(g)) { t += v; s = s.split(g).join(' '); matched = true; }
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => { const d = Number(b); if (d) { t += Number(a) / d; matched = true; } return ' '; });
  const m = s.match(/\d+(\.\d+)?/);
  if (m) { t += Number(m[0]); matched = true; }
  if (!matched && half) return 0.5;
  if (matched && half && t === Math.floor(t)) t += 0.5;
  return matched ? t : null;
}
const normUnit = (u) => String(u ?? '').replace(/‌/g, ' ').replace(/[يی]/g, 'ی').replace(/[كک]/g, 'ک').replace(/\s+/g, ' ').trim();
const MASS = { 'گرم': 1, 'گ': 1, 'g': 1, 'gram': 1, 'grams': 1, 'کیلوگرم': 1000, 'کیلو': 1000, 'کیلوگرمی': 1000, 'kg': 1000 };
const VOLUME_ML = { 'میلی لیتر': 1, 'میلیلیتر': 1, 'سی سی': 1, 'cc': 1, 'ml': 1, 'لیتر': 1000, 'l': 1000, 'لیوان': 240, 'فنجان': 240 };
const GLOBAL = { 'قاشق غذاخوری': 13.7, 'قاشق سوپخوری': 13.7, 'قاشق غذا خوری': 13.7, 'قاشق چایخوری': 3, 'قاشق چای خوری': 3, 'قاشق مرباخوری': 5, 'پیمانه': 180, 'عدد': 110, 'عدد متوسط': 120, 'عدد بزرگ': 150, 'عدد کوچک': 70, 'نصف عدد': 55, 'ربع عدد': 28, 'حبه': 3, 'دسته': 40, 'ساقه': 15, 'شاخه': 15, 'برگ': 1, 'پر': 1, 'تکه': 30, 'تکه کوچک': 15, 'برش': 25, 'قاچ': 30 };

// per-unit sanity bands (g) — a mined median outside its band is a corpus artifact and is rejected.
const SANITY = { 'عدد': [1, 600], 'عدد متوسط': [10, 600], 'عدد بزرگ': [10, 800], 'عدد کوچک': [1, 400], 'پیمانه': [15, 280], 'قاشق غذاخوری': [2, 30], 'قاشق چای خوری': [0.5, 12], 'قاشق چایخوری': [0.5, 12], 'حبه': [1, 12], 'دسته': [5, 120], 'ساقه': [2, 60], 'شاخه': [2, 60], 'نصف عدد': [1, 300], 'ربع عدد': [1, 150] };

// ── DOCUMENTED REFERENCE TABLE (src='curated') — standard culinary gram weights. Wins over a mined value. ──
// Densities (g/ml) for liquids/oils — refines ml/litre/glass.
const DENSITY = { ing_sunflower_oil: 0.92, ing_vegetable_oil: 0.92, ing_olive_oil: 0.91, ing_canola_oil: 0.92, ing_corn_oil: 0.92, ing_sesame_oil: 0.92, ing_ghee: 0.91, ing_honey: 1.42, ing_grape_molasses: 1.4, ing_date_syrup: 1.37, ing_whole_milk: 1.03, ing_low_fat_milk: 1.03 };
// Per-(ingredient,unit) documented grams. عدد = one typical piece; پیمانه = one US cup (240 ml).
const CURATED = {
  // — cups (پیمانه): the high-calorie cases a generic 180 g gets wrong —
  ing_all_purpose_flour: { 'پیمانه': 120 },      // King Arthur: 1 cup AP flour = 120 g (corrects a spurious 30 g mine)
  ing_whole_wheat_flour: { 'پیمانه': 113 },
  ing_rice_flour: { 'پیمانه': 158 },
  ing_chickpea_flour: { 'پیمانه': 92 },
  ing_cornstarch: { 'پیمانه': 128 },
  ing_semolina: { 'پیمانه': 167 },
  ing_powdered_sugar: { 'پیمانه': 120 },
  ing_brown_sugar: { 'پیمانه': 200 },
  ing_raisins: { 'پیمانه': 145 }, ing_golden_raisins: { 'پیمانه': 145 },
  ing_corn_kernels_canned: { 'پیمانه': 165 },
  ing_pistachios_raw: { 'پیمانه': 123 }, ing_almonds_raw: { 'پیمانه': 143 }, ing_hazelnuts_raw: { 'پیمانه': 135 },
  ing_white_beans_dry: { 'پیمانه': 185 }, ing_pinto_beans_dry: { 'پیمانه': 193 }, ing_mung_beans_dry: { 'پیمانه': 207 }, ing_split_peas_dry: { 'پیمانه': 200 }, ing_red_lentils_dry: { 'پیمانه': 192 }, ing_black_eyed_peas_dry: { 'پیمانه': 167 },
  ing_broad_beans_fresh: { 'پیمانه': 150 },
  ing_greek_yogurt_plain: { 'پیمانه': 245 },
  ing_cantaloupe_raw: { 'پیمانه': 160 }, ing_pomegranate_raw: { 'پیمانه': 174 },
  ing_candied_orange_peel: { 'پیمانه': 100 }, ing_orange_zest: { 'پیمانه': 96 },
  ing_date_dried: { 'پیمانه': 147, 'عدد': 8 }, ing_pitted_dates: { 'پیمانه': 147, 'عدد': 8 },
  ing_sabzi_polo_mix: { 'پیمانه': 45 }, ing_tareh_fresh: { 'پیمانه': 50 }, ing_chives_fresh: { 'پیمانه': 50 },
  ing_shredded_coconut: { 'پیمانه': 93 }, ing_oats: { 'پیمانه': 90 }, ing_breadcrumbs: { 'پیمانه': 108 },
  // — pieces (عدد): the high-calorie breads/doughs/proteins; plus common produce for precision —
  ing_pizza_dough: { 'عدد': 250 }, ing_pita_bread: { 'عدد': 60 }, ing_taftoon_bread: { 'عدد': 80 }, ing_barbari_bread: { 'عدد': 240 }, ing_sangak_bread: { 'عدد': 280 }, ing_tortilla: { 'عدد': 50 }, ing_burger_bun: { 'عدد': 55 }, ing_baguette: { 'عدد': 250 }, ing_white_bread: { 'برش': 28, 'عدد': 28 },
  ing_beef_sausage_raw: { 'عدد': 75 }, ing_hot_dog: { 'عدد': 50 }, ing_lamb_shank_raw: { 'عدد': 250 },
  ing_lasagna_sheets_dry: { 'عدد': 25 }, ing_dumpling_wrappers: { 'عدد': 8 }, ing_phyllo_dough: { 'ورق': 19, 'عدد': 19 }, ing_puff_pastry: { 'ورق': 40, 'عدد': 40 }, ing_grape_leaves: { 'عدد': 3 }, ing_nori_sheets: { 'عدد': 3 },
  ing_egg_white_raw: { 'عدد': 33 }, ing_egg_yolk_raw: { 'عدد': 17 },
  ing_apple_raw: { 'عدد': 182, 'عدد متوسط': 182 }, ing_orange_raw: { 'عدد': 131 }, ing_banana_raw: { 'عدد': 118 }, ing_pear_raw: { 'عدد': 178 }, ing_peach_raw: { 'عدد': 150 },
  ing_cucumber_raw: { 'عدد': 120 }, ing_leek_raw: { 'عدد': 89 }, ing_beetroot_raw: { 'عدد': 110 }, ing_shallot_raw: { 'عدد': 50 }, ing_red_onion_raw: { 'عدد': 110, 'عدد متوسط': 120 }, ing_radish_raw: { 'عدد': 15 }, ing_turnip_raw: { 'عدد': 120 }, ing_kohlrabi_raw: { 'عدد': 150 }, ing_lettuce_raw: { 'عدد': 300 }, ing_cabbage_raw: { 'عدد': 900 }, ing_zucchini_raw: { 'عدد': 196 }, ing_celery_raw: { 'ساقه': 40 },
  // — dense condiments in spoons (documented tbsp/tsp weights — small mass, but curated beats the generic 13.7) —
  ing_soy_sauce: { 'قاشق غذاخوری': 16, 'قاشق چای خوری': 5.3 }, ing_oyster_sauce: { 'قاشق غذاخوری': 18 }, ing_mirin: { 'قاشق غذاخوری': 15 }, ing_ketchup: { 'قاشق غذاخوری': 17 }, ing_pizza_sauce: { 'قاشق غذاخوری': 16 },
  ing_tahini: { 'قاشق غذاخوری': 15, 'قاشق چای خوری': 5 }, ing_tahini_sauce: { 'قاشق غذاخوری': 15 }, ing_pesto_sauce: { 'قاشق غذاخوری': 15 }, ing_red_curry_paste: { 'قاشق غذاخوری': 16 }, ing_dijon_mustard: { 'قاشق غذاخوری': 15, 'قاشق چای خوری': 5 }, ing_capers: { 'قاشق غذاخوری': 9 },
  ing_powdered_sugar: { 'قاشق غذاخوری': 7.5, 'قاشق چای خوری': 2.5 }, ing_caster_sugar: { 'قاشق غذاخوری': 12.5, 'قاشق چای خوری': 4.2 }, ing_palm_sugar: { 'قاشق غذاخوری': 12, 'قاشق چای خوری': 4 }, ing_cornstarch: { 'پیمانه': 128, 'قاشق غذاخوری': 8, 'قاشق چای خوری': 2.7 },
  ing_sesame_oil: { 'قاشق غذاخوری': 13.6, 'قاشق چای خوری': 4.5 }, ing_honey: { 'قاشق غذاخوری': 21, 'قاشق چای خوری': 7 }, ing_grape_molasses: { 'قاشق غذاخوری': 20 }, ing_date_syrup: { 'قاشق غذاخوری': 20 },
  ing_active_dry_yeast: { 'قاشق چای خوری': 3, 'قاشق غذاخوری': 9 }, ing_yeast_dry: { 'قاشق چای خوری': 3, 'قاشق غذاخوری': 9 }, ing_dashi_powder: { 'قاشق چای خوری': 3 }, ing_chia_seeds: { 'قاشق غذاخوری': 12 }, ing_slivered_pistachios: { 'قاشق غذاخوری': 8 }, ing_chickpea_flour: { 'پیمانه': 92, 'قاشق غذاخوری': 7 },
};

function curatedFor(id) { return CURATED[id] || null; }

/** Mine per-(ingredient,unit) and global per-unit grams from every GRIS-weightG × authored-amount pairing. */
function mine(recipes) {
  const perIU = new Map();
  for (const r of recipes) {
    const g = grisIngs(r.gris); if (!g) continue;
    const w = new Map();
    for (const gi of g) { const id = gi.ingredientId || parseId(gi.name); const ww = weightOf(gi); if (id && ww != null && !w.has(id)) w.set(id, ww); }
    for (const ri of (r.ingredients || [])) {
      if (!ri.ingredientId || !ri.unit) continue;
      const a = parseAmount(ri.amount); if (a == null || !(a > 0)) continue;
      const ww = w.get(ri.ingredientId); if (ww == null) continue;
      const gpu = ww / a; if (!(gpu > 0) || gpu > 3000) continue;
      const u = normUnit(ri.unit); if (MASS[u] != null) continue; // mass needs no factor
      const k = `${ri.ingredientId}|${u}`;
      if (!perIU.has(k)) perIU.set(k, []); perIU.get(k).push(gpu);
    }
  }
  const out = new Map();
  for (const [k, vals] of perIU) {
    const u = k.split('|')[1];
    const g = median(vals);
    const band = SANITY[u];
    if (band && (g < band[0] || g > band[1])) continue; // reject an out-of-band artifact
    out.set(k, { g: Math.round(g * 10) / 10, n: vals.length });
  }
  return out;
}

/** Build the gramConversions object for one ingredient from curated + mined, over the units it's authored with. */
function buildConversions(id, units, mIU) {
  const perUnit = {};
  const curated = curatedFor(id);
  for (const u of units) {
    if (MASS[u] != null || VOLUME_ML[u] != null) continue; // resolver handles mass + volume(+density) directly
    if (curated && curated[u] != null) { perUnit[u] = { g: curated[u], src: 'curated' }; continue; }
    const m = mIU.get(`${id}|${u}`);
    if (m && m.n >= MIN_N) { perUnit[u] = { g: m.g, src: 'mined', n: m.n }; continue; }
    // also accept a curated base for a size-variant unit (e.g. «عدد متوسط» off curated «عدد»)
    if (curated) { const base = u.startsWith('عدد') && curated['عدد'] != null ? curated['عدد'] : null; if (base != null) perUnit[u] = { g: base, src: 'curated' }; }
  }
  // include any curated unit even if it wasn't seen in this ingredient's authored set (harmless, future-proofs)
  if (curated) for (const [u, g] of Object.entries(curated)) if (perUnit[u] == null && MASS[u] == null) perUnit[u] = { g, src: 'curated' };
  const density = DENSITY[id] ?? null;
  if (!Object.keys(perUnit).length && density == null) return null;
  return { perUnit, ...(density != null ? { densityGPerMl: density } : {}), source: SOURCE_TAG };
}

// ── resolver mirror (for the honest before/after coverage measurement only) ──
function resolveGrams(amount, unit, conv) {
  if (amount == null || !(amount > 0)) return { grams: null, grounded: false };
  const u = normUnit(unit); if (!u) return { grams: null, grounded: false };
  const density = conv && conv.densityGPerMl > 0 ? conv.densityGPerMl : null;
  if (MASS[u] != null) return { grams: amount * MASS[u], grounded: true };
  const pu = conv && conv.perUnit && conv.perUnit[u];
  if (pu && pu.g > 0) return { grams: amount * pu.g, grounded: true };
  if (VOLUME_ML[u] != null) return density != null ? { grams: amount * VOLUME_ML[u] * density, grounded: true } : { grams: amount * VOLUME_ML[u], grounded: false };
  if (GLOBAL[u] != null) return { grams: amount * GLOBAL[u], grounded: false };
  return { grams: null, grounded: false };
}
const NEG_CAT = new Set(['spice', 'salt', 'herb', 'seasoning', 'leavening']);
const NEG_NAME = /نمک|فلفل|زردچوبه|زعفران|دارچین|هل\b|نعناع|پاپریکا|زنجبیل|آویشن|سماق|زیره|وانیل|جوش\s*شیرین|بکینگ|ادویه/;
const TOTASTE = /به\s*مزه|به\s*مقدار\s*لازم|به\s*دلخواه|به\s*اندازه|اختیار|نوک\s*قاشق/;
const SMALL_VOLUME_UNIT = /قاشق|نوک\s*قاشق|میلی\s*لیتر|^ml$|سی\s*سی|^cc$/; // tiny mass → generic factor trusted
function dishFullyComputable(recipe, dictConv, dictNut, dictCat) {
  const grisW = new Map();
  for (const gi of (grisIngs(recipe.gris) || [])) { const id = gi.ingredientId || parseId(gi.name); const w = weightOf(gi); if (id && w != null && !grisW.has(id)) grisW.set(id, w); }
  let considered = 0, resolved = 0;
  for (const ri of (recipe.ingredients || [])) {
    const id = ri.ingredientId; const p = id ? dictNut.get(id) : null; const cat = id ? dictCat.get(id) : null;
    const kcal = p ? Number(p.calories) : null;
    const gw = id ? grisW.get(id) : null;
    const r = gw != null ? { grams: gw, grounded: true } : resolveGrams(parseAmount(ri.amount), ri.unit, id ? dictConv.get(id) : null);
    const smallUnit = SMALL_VOLUME_UNIT.test(normUnit(ri.unit));
    const grounded = r.grams != null && (r.grounded || smallUnit || (kcal != null && kcal <= GLOBAL_TRUST_KCAL));
    if (r.grams != null && grounded && p) { considered++; resolved++; continue; }
    const neg = (kcal != null && kcal <= 5) || (cat && NEG_CAT.has(cat)) || NEG_NAME.test(ri.name || '') || ((parseAmount(ri.amount) == null || TOTASTE.test(ri.unit || '')) && kcal != null && kcal <= 60) || (p == null && (NEG_NAME.test(ri.name || '') || (cat && NEG_CAT.has(cat)) || TOTASTE.test(`${ri.unit || ''} ${ri.name || ''}`)));
    if (neg) continue;
    considered++; // a real, un-groundable ingredient → blocks
  }
  return considered > 0 && resolved === considered && resolved >= MIN_RESOLVED;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(url); const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error(`SAFETY STOP: expected local garnish_db, got ${dbName}@${parsed.hostname}`);

  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({ where: { status: 'active', isPublic: true }, select: { id: true, title: true, gris: true, ingredients: { select: { name: true, ingredientId: true, amount: true, unit: true } } } });
    const usedIds = new Set(); const unitsById = new Map();
    for (const r of recipes) for (const ri of (r.ingredients || [])) { if (!ri.ingredientId) continue; usedIds.add(ri.ingredientId); const u = normUnit(ri.unit); if (u) { if (!unitsById.has(ri.ingredientId)) unitsById.set(ri.ingredientId, new Set()); unitsById.get(ri.ingredientId).add(u); } }
    // NOTE: read nutrition/category via the typed client, but read the NEW gramConversions column via RAW SQL —
    // the generated Prisma client predates this column until `prisma generate` runs, so a typed select would throw.
    const dict = await prisma.ingredient.findMany({ where: { id: { in: [...usedIds] } }, select: { id: true, nameFa: true, category: true, nutritionPer100g: true } });
    const dictNut = new Map(dict.map((d) => [d.id, d.nutritionPer100g && typeof d.nutritionPer100g === 'object' ? d.nutritionPer100g : null]));
    const dictCat = new Map(dict.map((d) => [d.id, d.category]));
    await prisma.$executeRawUnsafe('ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "gramConversions" JSONB'); // self-contained if migrate hasn't run
    const existingRows = await prisma.$queryRawUnsafe('SELECT id, "gramConversions" AS gc FROM "Ingredient" WHERE id = ANY($1::text[])', [...usedIds]);
    const beforeConv = new Map(existingRows.map((r) => [r.id, r.gc && typeof r.gc === 'object' ? r.gc : null]));
    const havingNow = [...beforeConv.values()].filter(Boolean).length;
    const computableBefore = recipes.filter((r) => dishFullyComputable(r, beforeConv, dictNut, dictCat)).length;
    console.log(`[coverage] used ingredients: ${usedIds.size} | with gramConversions BEFORE: ${havingNow} | dishes fully-computable BEFORE: ${computableBefore}/${recipes.length}`);
    if (verifyOnly) return;

    const mIU = mine(recipes);
    const plan = []; // { id, name, conv }
    let mined = 0, curated = 0;
    for (const id of usedIds) {
      const units = unitsById.get(id) || new Set();
      const conv = buildConversions(id, units, mIU);
      if (!conv) continue;
      for (const e of Object.values(conv.perUnit)) { if (e.src === 'mined') mined++; else if (e.src === 'curated') curated++; }
      plan.push({ id, name: dict.find((d) => d.id === id)?.nameFa || id, conv });
    }
    const afterConv = new Map(beforeConv); for (const p of plan) afterConv.set(p.id, p.conv);
    const stillBlocked = recipes.filter((r) => !dishFullyComputable(r, afterConv, dictNut, dictCat));
    const computableAfter = recipes.length - stillBlocked.length;

    console.log(`\n[plan] ingredients getting gramConversions: ${plan.length} | perUnit entries: mined=${mined} curated=${curated} | mode=${apply ? 'APPLY' : 'dry-run'}`);
    console.log(`[coverage] dishes fully-computable AFTER (grounded-only gate): ${computableAfter}/${recipes.length} (${Math.round(computableAfter / recipes.length * 100)}%)  [was ${computableBefore}]`);
    if (stillBlocked.length) console.log(`[honest gaps] ${stillBlocked.length} dishes still not live-computable (genuine data gaps — an unquantified real-calorie ingredient; same holes as the Nutrition backfill):\n   • ${stillBlocked.map((r) => r.title).join('\n   • ')}`);
    console.log('\n[sample] 16 ingredient conversions:');
    for (const p of plan.slice(0, 16)) console.log(`  ${p.name} [${p.id}] → ${Object.entries(p.conv.perUnit).map(([u, e]) => `«${u}»=${e.g}g(${e.src}${e.n ? ':' + e.n : ''})`).join('  ')}${p.conv.densityGPerMl ? `  ρ=${p.conv.densityGPerMl}` : ''}`);

    if (!apply) { console.log('\n[dry-run] no writes. Re-run with --apply.'); return; }

    await prisma.$executeRawUnsafe('ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "gramConversions" JSONB');
    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const p of plan) {
        const res = await tx.$executeRawUnsafe('UPDATE "Ingredient" SET "gramConversions" = $1::jsonb WHERE id = $2', JSON.stringify(p.conv), p.id);
        updated += res;
      }
    }, { timeout: 120000, maxWait: 30000 });
    console.log(`\n[apply] gramConversions written: ${updated} ingredients (source='${SOURCE_TAG}')`);
    const afterRows = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM "Ingredient" WHERE id = ANY($1::text[]) AND "gramConversions" IS NOT NULL', [...usedIds]);
    console.log(`[coverage] used ingredients with gramConversions AFTER: ${afterRows[0].c}/${usedIds.size}`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('BACKFILL ERROR:', e.message); process.exit(1); });
