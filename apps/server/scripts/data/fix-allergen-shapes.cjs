/**
 * FIX ALLERGEN SHAPES (DEV, SAFETY) — canonicalize Ingredient.allergens in the live DB.
 *
 * Two pre-existing defects that made the allergy HARD filter silently miss allergens:
 *  (1) ~300 records use a malformed BARE-ARRAY shape (["nuts"], ["dairy"], ["gluten"]) instead of the
 *      object {us9,eu14,other,mayContain} — extractDictionaryAllergens returned [] for these.
 *  (2) non-canonical tokens (nuts vs tree_nuts, dairy vs milk, gluten vs wheat/gluten_cereals).
 * The parser is now hardened too (recipe-integrity.ts), but the DATA should also be clean for every other
 * consumer (recsys, food-dna, substitutions). Over-maps ambiguous tokens (seafood→fish+shellfish) — safe.
 *
 * Touches ONLY the allergens column (never nutrition/source-lock/substitutions). Usage:
 *   node fix-allergen-shapes.cjs [--apply]   (dry-run by default)
 */
const { PrismaClient } = require('@prisma/client');

const isLocal = (h) => ['localhost', '127.0.0.1', '::1'].includes(h);
// ⚠ MIRROR of the runtime SOURCE OF TRUTH: src/recipes/intelligence/recipe-integrity.ts ALLERGEN_ALIASES.
// Keep in sync. (Build constraints — no dist asset-copy — keep the authoritative map inline in the .ts gate
// rather than a shared import; a narrower map HERE would re-introduce the crustacean-variant under-match into the
// dictionary data on the next run.)
const ALIASES = {
  nuts: ['tree_nuts'], nut: ['tree_nuts'], treenuts: ['tree_nuts'], 'tree nuts': ['tree_nuts'], 'tree-nuts': ['tree_nuts'],
  peanuts: ['peanut'], groundnut: ['peanut'], groundnuts: ['peanut'],
  dairy: ['milk'], lactose: ['milk'],
  gluten: ['gluten_cereals', 'wheat'], wheat: ['wheat', 'gluten_cereals'], gluten_cereal: ['gluten_cereals'],
  seafood: ['fish', 'shellfish', 'crustaceans', 'molluscs'], shellfish: ['shellfish', 'crustaceans', 'molluscs'], crustacean: ['crustaceans'], crustaceans: ['crustaceans'], molluscs: ['molluscs'], mollusks: ['molluscs'], mollusc: ['molluscs'], mollusk: ['molluscs'],
  'crustacean shellfish': ['crustaceans'], crustacean_shellfish: ['crustaceans'], 'crustacean-shellfish': ['crustaceans'],
  soya: ['soy'], soybean: ['soy'], soybeans: ['soy'], egg: ['eggs'],
  celeriac: ['celery'], lupine: ['lupin'], lupins: ['lupin'],
  'mustard seed': ['mustard'], 'mustard seeds': ['mustard'], finfish: ['fish'],
  sulphite: ['sulphites'], sulfite: ['sulphites'], sulfites: ['sulphites'],
  'sulphur dioxide': ['sulphites'], sulphur_dioxide: ['sulphites'], 'sulfur dioxide': ['sulphites'], sulfur_dioxide: ['sulphites'], so2: ['sulphites'],
};
const canon = (tokens) => {
  const out = new Set();
  for (const raw of tokens || []) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    (ALIASES[t] || [t]).forEach((m) => out.add(m));
  }
  return [...out].sort();
};

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const parsed = new URL(url);
  if (parsed.pathname.replace(/^\//, '') !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error('SAFETY STOP: expected local garnish_db');

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.ingredient.findMany({ select: { id: true, allergens: true } });
    let bareArrays = 0, tokenNorm = 0, changed = 0;
    const updates = [];
    for (const r of rows) {
      const a = r.allergens;
      if (a == null) continue;
      let nextTokens; let wasBare = false;
      if (Array.isArray(a)) { nextTokens = canon(a); wasBare = true; bareArrays += 1; }
      else if (typeof a === 'object') {
        const collected = [];
        for (const k of ['us9', 'eu14', 'other', 'mayContain']) if (Array.isArray(a[k])) collected.push(...a[k]);
        // keep PAL ("mayContain") separate; canonicalize the declared (us9∪eu14∪other) set
        const declared = [];
        for (const k of ['us9', 'eu14', 'other']) if (Array.isArray(a[k])) declared.push(...a[k]);
        nextTokens = canon(declared);
        // detect token normalization needed (existing declared set differs from canonical)
        const existing = [...new Set(declared.map((x) => String(x).trim().toLowerCase()).filter(Boolean))].sort();
        if (JSON.stringify(existing) !== JSON.stringify(nextTokens)) tokenNorm += 1; else continue;
        // preserve mayContain (canonicalized too)
        const mayContain = Array.isArray(a.mayContain) ? canon(a.mayContain) : [];
        updates.push({ id: r.id, value: { us9: nextTokens, eu14: nextTokens, other: [], mayContain } });
        changed += 1;
        continue;
      } else continue;
      if (wasBare) {
        updates.push({ id: r.id, value: { us9: nextTokens, eu14: nextTokens, other: [], mayContain: [] } });
        changed += 1;
      }
    }
    console.log(`[plan] ${rows.length} ingredients | bare-array=${bareArrays} | token-normalize=${tokenNorm} | to-update=${changed} | mode=${apply ? 'APPLY' : 'dry-run'}`);
    // show a few sample bare-array conversions
    updates.filter((u, i) => i < 8).forEach((u) => console.log(`  • ${u.id} → ${JSON.stringify(u.value.us9)}`));
    if (!apply) { console.log('[dry-run] no writes. Re-run with --apply.'); return; }
    let n = 0;
    for (const u of updates) { await prisma.ingredient.update({ where: { id: u.id }, data: { allergens: u.value } }); n += 1; }
    console.log(`[apply] updated allergens on ${n} ingredients (only the allergens column touched).`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
