/**
 * FIX ALLERGEN GAPS (DEV, SAFETY) — ADD factually-missing major allergens to ingredients whose
 * dictionary entry has an EMPTY allergen set but whose identity unambiguously implies an allergen
 * (e.g. puff pastry / phyllo / pasta → wheat+gluten_cereals; cheese/cream → milk; named tree nuts →
 * tree_nuts). This is the "missing allergen" class (distinct from the shape/token fix).
 *
 * SAFETY policy: ADD-ONLY, never remove. Over-flagging an allergen is safe; under-flagging is dangerous.
 * Only acts on ingredients whose current declared allergen set is EMPTY (won't touch curated entries).
 * Matches are intentionally high-confidence; ambiguous items (plain "flour", oats, gluten-free flours)
 * are excluded. Touches ONLY the allergens column. Usage: node fix-allergen-gaps.cjs [--apply]
 */
const { PrismaClient } = require('@prisma/client');
const isLocal = (h) => ['localhost', '127.0.0.1', '::1'].includes(h);

// HAND-VERIFIED whitelist (a naive name heuristic produced ~25 dangerous false positives — «خمیر» =
// dough OR paste, «کره» = butter OR bean/fruit-butter, breadfruit/spaghetti-squash/yeast/pineapple/
// water-chestnut/vegan-cheese/cream-of-tartar — so we list only items confirmed wheat-bearing). Each
// adds wheat + gluten_cereals. Milk/coconut/tree-nut gaps are DEFERRED to a dedicated verified audit
// (coconut's tree-nut status is genuinely debated; the milk heuristic was 100% false here).
const GAP_FILL = {
  wheat: ['ing_brioche', 'ing_crackers_plain', 'ing_graham_crackers', 'ing_bagel_plain', 'ing_sourdough_bread', 'ing_bao_buns', 'ing_lasagna_sheets_dry', 'ing_puff_pastry', 'ing_tempura_batter_mix', 'ing_gyoza_wrappers', 'ing_wonton_wrappers', 'ing_spring_roll_wrappers', 'ing_digestive_biscuits', 'ing_farro_raw', 'ing_pizza_crust_prebaked', 'ing_croissant_plain', 'ing_elbow_macaroni_dry', 'ing_udon_noodles', 'ing_ramen_noodles_dry', 'ing_pizza_dough', 'ing_baguette', 'ing_phyllo_dough', 'ing_dumpling_wrappers', 'ing_ladyfingers', 'ing_breadcrumbs_panko', 'ing_gnocchi_potato', 'ing_soba_noodles'],
};
const ID_TOKENS = new Map();
for (const id of GAP_FILL.wheat) ID_TOKENS.set(id, ['gluten_cereals', 'wheat']);
const RULES = []; // heuristic disabled — whitelist only (see ID_TOKENS)

const declaredEmpty = (a) => {
  if (a == null) return true;
  if (Array.isArray(a)) return a.length === 0;
  if (typeof a === 'object') return ['us9', 'eu14', 'other'].every((k) => !Array.isArray(a[k]) || a[k].length === 0);
  return true;
};

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const parsed = new URL(url);
  if (parsed.pathname.replace(/^\//, '') !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error('SAFETY STOP: expected local garnish_db');

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.ingredient.findMany({ select: { id: true, nameFa: true, nameEn: true, category: true, allergens: true } });
    const updates = [];
    for (const r of rows) {
      if (!declaredEmpty(r.allergens)) continue; // only fill genuine gaps; never override curated
      const whitelisted = ID_TOKENS.get(r.id);
      const tokens = new Set(whitelisted || []);
      if (tokens.size) {
        const arr = [...tokens].sort();
        const may = (r.allergens && !Array.isArray(r.allergens) && Array.isArray(r.allergens.mayContain)) ? r.allergens.mayContain : [];
        updates.push({ id: r.id, nameFa: r.nameFa, value: { us9: arr, eu14: arr, other: [], mayContain: may }, tokens: arr });
      }
    }
    console.log(`[plan] gaps to fill=${updates.length} | mode=${apply ? 'APPLY' : 'dry-run'}`);
    updates.forEach((u) => console.log(`  • ${u.id} (${u.nameFa || ''}) → ${JSON.stringify(u.tokens)}`));
    if (!apply) { console.log('\n[dry-run] REVIEW the list above. Re-run with --apply.'); return; }
    let n = 0;
    for (const u of updates) { await prisma.ingredient.update({ where: { id: u.id }, data: { allergens: u.value } }); n += 1; }
    console.log(`[apply] added missing allergens to ${n} ingredients (add-only, allergens column only).`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
