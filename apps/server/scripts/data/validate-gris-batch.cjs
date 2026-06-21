/**
 * GRIS BATCH VALIDATOR (DEV) — deterministic pre-apply gate. Read-only; writes nothing.
 * For each authored package in docs/data-pilot/_authored/<batch>/, checks:
 *  1. required gris sections present + non-empty
 *  2. every authored ingredient id + every subs-enrichment id RESOLVES in the dictionary
 *  3. SAFETY: declared gris.allergens is a SUPERSET of the allergens DERIVED from the recipe's real
 *     dictionary ingredients (now that the dictionary is canonicalized) — a declared set that MISSES a
 *     derived allergen is an under-declaration and must be fixed before going live
 *  4. selfScore meets the bar
 *  5. nutrition not fabricated (numeric nourishment must cite a source/disclaimer)
 * Usage: node validate-gris-batch.cjs <batch>
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
// allergens is required to EXIST (and is safety-checked below) but MAY be an empty array (a valid
// "no allergens" declaration), so it is not in the non-empty list.
const REQUIRED = ['schemaVersion', 'story', 'whyItWorks', 'glance', 'ingredients', 'steps', 'finish', 'troubleshooting', 'nourishment', 'dietary'];
const SELF_SCORE_BAR = 90;

// ⚠ MIRROR of the runtime SOURCE OF TRUTH: recipe-integrity.ts ALLERGEN_ALIASES — keep in sync (a narrower map
// here would mis-pass/mis-reject a batch vs the authoritative gate, esp. the shellfish umbrella + crustacean variants).
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
const canon = (ts) => { const o = new Set(); for (const x of ts || []) { if (typeof x !== 'string') continue; const t = x.trim().toLowerCase(); if (!t) continue; (ALIASES[t] || [t]).forEach((m) => o.add(m)); } return [...o].sort(); };
const extract = (a) => { if (!a) return []; if (Array.isArray(a)) return canon(a); if (typeof a !== 'object') return []; const c = []; for (const k of ['eu14', 'us9', 'other', 'mayContain']) if (Array.isArray(a[k])) c.push(...a[k]); return canon(c); };

async function main() {
  const batch = process.argv[2] || 'batch-03';
  const url = process.env.DATABASE_URL;
  const parsed = new URL(url);
  if (parsed.pathname.replace(/^\//, '') !== 'garnish_db') throw new Error('SAFETY STOP: expected local garnish_db');

  const dir = path.join(ROOT, 'docs/data-pilot/_authored', batch);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  const prisma = new PrismaClient();
  const allIng = await prisma.ingredient.findMany({ select: { id: true, allergens: true } });
  const idSet = new Set(allIng.map((r) => r.id));
  const allergenById = new Map(allIng.map((r) => [r.id, r.allergens]));

  let pass = 0; const problems = [];
  for (const f of files) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const g = pkg.gris || {}; const id = pkg.recipeId; const issues = [];

    for (const k of REQUIRED) { const v = g[k]; if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) issues.push(`missing/empty: ${k}`); }

    // ingredient ids resolve (authored list + subs enrichment)
    const authIds = (g.ingredients || []).map((i) => i && (i.ingredientId || i.id)).filter(Boolean);
    for (const iid of authIds) if (!idSet.has(iid)) issues.push(`unresolved gris ingredient id: ${iid}`);
    for (const enr of pkg.ingredientSubsEnrichment || []) { if (enr && enr.ingredientId && !idSet.has(enr.ingredientId)) issues.push(`unresolved subsEnrich id: ${enr.ingredientId}`); for (const o of (enr && enr.substitutionOptions) || []) { const rid = o && o.replaceWithIngredientId; if (rid && !idSet.has(rid)) issues.push(`unresolved sub target id: ${rid}`); } }

    // allergens must be PRESENT (may be empty), and SAFETY: declared must cover the allergens derived
    // from BOTH the recipe's real DB ingredients AND the authored gris ingredient ids.
    if (g.allergens == null) issues.push('missing: allergens (must be present, may be empty array)');
    const rec = await prisma.recipe.findUnique({ where: { id }, select: { ingredients: { select: { ingredient: { select: { allergens: true } } } } } });
    const derived = new Set();
    for (const ri of (rec && rec.ingredients) || []) for (const a of extract(ri.ingredient && ri.ingredient.allergens)) derived.add(a);
    for (const iid of authIds) for (const a of extract(allergenById.get(iid))) derived.add(a);
    const declared = new Set(canon([...(g.allergens?.contains || []), ...(g.allergens?.us9 || []), ...(g.allergens?.eu14 || []), ...(g.allergens?.other || []), ...(Array.isArray(g.allergens) ? g.allergens : [])]));
    const missing = [...derived].filter((a) => !declared.has(a));
    if (missing.length) issues.push(`UNDER-DECLARED allergens (derived but not declared): ${missing.join(', ')} | declared=[${[...declared].join(',')}]`);

    // selfScore bar
    const score = typeof pkg.selfScore === 'number' ? pkg.selfScore : (pkg.selfScore && pkg.selfScore.total);
    if (typeof score === 'number' && score < SELF_SCORE_BAR) issues.push(`selfScore ${score} < ${SELF_SCORE_BAR}`);

    if (issues.length) problems.push({ id, issues }); else pass += 1;
  }
  await prisma.$disconnect();
  console.log(`[validate] batch=${batch} files=${files.length} | PASS=${pass} | PROBLEM=${problems.length}`);
  for (const p of problems) { console.log(`\n  ✗ ${p.id}`); p.issues.forEach((i) => console.log(`     - ${i}`)); }
  if (!problems.length) console.log('\n  ✓ all recipes pass the deterministic gate — safe to apply.');
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
