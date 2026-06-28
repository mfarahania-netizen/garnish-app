/**
 * AUDIT — legacy (source IS NULL) Nutrition rows vs the live gram-conversion compute. READ-ONLY. DEV / local only.
 *
 * WHY: the Persian nutrition backfill only filled rows that were NULL, so the pre-existing rows (mostly imported,
 * `source = NULL`) were never re-checked against the recipe's OWN ingredients. The new amount→gram layer can now
 * recompute a faithful per-serving total from each recipe's authored ingredients. Where the legacy STORED value
 * disagrees with that faithful sum, ONE of them is wrong — and the chat's dish-nutrition path PREFERS the stored
 * row, so users may see the stale number. This surfaces every >threshold divergence with the per-ingredient
 * evidence and a DEFAULT recommendation, so a human can decide: trust the live sum, or fix the recipe's amount.
 *
 * IT PROPOSES — IT DOES NOT WRITE. There is deliberately NO --apply: overwriting ~250 imported nutrition rows on
 * a heuristic is exactly the kind of silent damage the honesty discipline forbids. Output is a report + a
 * proposals JSON for review; a later deliberate step applies the approved ones.
 *
 * FAITHFULNESS: it imports the REAL compiled compute (dist/.../dish-nutrition.js + ingredient-grams.js) — the SAME
 * functions the live server runs — so the audit measures exactly what users see, with zero logic drift. Run it
 * from a BUILT checkout (the dev server's `nest build`/watch output, or `npm run build` first).
 *
 * SAFETY: local `garnish_db` ONLY (hard stop); never writes the DB; touches no allergy gate / recipe-visibility /
 * gramConversions / Nutrition row. Pure read + report.
 *
 * RUN:
 *   node --env-file=.env scripts/data/audit-legacy-nutrition.cjs              # report >20% divergences
 *   node --env-file=.env scripts/data/audit-legacy-nutrition.cjs --threshold=0.30   # custom threshold
 *   node --env-file=.env scripts/data/audit-legacy-nutrition.cjs --all        # also list the consistent ones
 */
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

// the REAL compiled compute — audit exactly what the server computes (no drift).
const DIST = path.resolve(__dirname, '../../dist/src/recipes/intelligence');
let computeDishNutrition, buildDishInputs, resolveGrams;
try {
  ({ computeDishNutrition, buildDishInputs } = require(path.join(DIST, 'dish-nutrition.js')));
  ({ resolveGrams } = require(path.join(DIST, 'ingredient-grams.js')));
} catch (e) {
  console.error(`BUILD REQUIRED: could not load the compiled compute from ${DIST}\n  Build first (npm run build) or run from the dev-server checkout. (${e.message})`);
  process.exit(1);
}

const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const THRESHOLD = Math.max(0, Number(arg('threshold', '0.20')) || 0.20);
const SHOW_ALL = process.argv.includes('--all');
const r0 = (x) => Math.round(x);
const pct = (x) => `${Math.round(x * 100)}%`;

const OIL_RE = /روغن|\boil\b/i;
const isOil = (it) => it.category === 'oil' || OIL_RE.test(it.name || '');

/**
 * per-ingredient kcal breakdown — the evidence for a verdict. Mirrors the production deep-fry-oil model so the
 * numbers match the computed total: a frying bath (friedHint, or oil ≥150g) is shown as the absorbed uptake
 * (≈10% of the solids' weight), not the discarded bath.
 */
function breakdown(inputs, friedHint) {
  const grams = (it) => (typeof it.weightG === 'number' && it.weightG > 0 ? { grams: it.weightG, source: 'gris', grounded: true } : resolveGrams({ amount: it.amount, unit: it.unit, gramConversions: it.gramConversions }));
  const rows = [];
  const oils = [];
  let solidG = 0;
  for (const it of inputs) {
    const cal100 = it.per100g && Number.isFinite(Number(it.per100g.calories)) ? Number(it.per100g.calories) : null;
    if (cal100 == null) continue;
    const r = grams(it);
    if (r.grams == null) { if (isOil(it)) oils.push({ it, cal100, grams: null }); continue; }
    if (isOil(it)) { oils.push({ it, cal100, grams: r.grams }); continue; }
    solidG += r.grams;
    rows.push({ name: String(it.name || '').trim(), grams: r.grams, kcal: (cal100 * r.grams) / 100, source: r.source, grounded: r.grounded });
  }
  if (oils.length) {
    const oilTotalG = oils.reduce((s, o) => s + (o.grams ?? 0), 0);
    const rep = oils.find((o) => o.cal100 != null) || oils[0];
    const isBath = friedHint || oilTotalG >= 150;
    const oilG = isBath ? 0.1 * solidG : oilTotalG;
    if (oilG > 0 && rep.cal100 != null) rows.push({ name: String(rep.it.name || 'روغن').trim() + (isBath ? ' (سرخ‌کردنی/جذب‌شده)' : ''), grams: oilG, kcal: (rep.cal100 * oilG) / 100, source: isBath ? 'fry-uptake' : 'oil', grounded: true });
  }
  return rows.sort((a, b) => b.kcal - a.kcal);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(url); const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error(`SAFETY STOP: expected local garnish_db, got ${dbName}@${parsed.hostname}`);

  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({
      where: { status: 'active', isPublic: true },
      select: {
        id: true, title: true, servings: true, gris: true, region: true,
        nutrition: { select: { calories: true, protein: true, source: true } },
        ingredients: { select: { name: true, ingredientId: true, amount: true, unit: true } },
      },
    });
    // scope: a stored value that was NEVER re-validated by the backfill (source IS NULL) and is non-null.
    const legacy = recipes.filter((r) => r.nutrition && r.nutrition.source == null && r.nutrition.calories != null);
    const ids = new Set();
    for (const r of legacy) for (const ri of r.ingredients) if (ri.ingredientId) ids.add(ri.ingredientId);
    const dict = await prisma.ingredient.findMany({ where: { id: { in: [...ids] } }, select: { id: true, nutritionPer100g: true, category: true, gramConversions: true } });
    const D = new Map(dict.map((d) => [d.id, { nutritionPer100g: d.nutritionPer100g, category: d.category, gramConversions: d.gramConversions }]));

    const divergent = [], consistent = [], notComputable = [];
    for (const r of legacy) {
      const { inputs, servings, friedHint } = buildDishInputs(r, D);
      const res = computeDishNutrition(inputs, servings, { friedHint });
      const stored = Number(r.nutrition.calories);
      if (!res.perServing || res.perServing.calories == null) { notComputable.push({ title: r.title, stored, blockers: res.blockers }); continue; }
      const live = res.perServing.calories;
      const div = stored > 0 ? Math.abs(live - stored) / stored : 1;
      const rec = { id: r.id, title: r.title, region: r.region, servings, stored, live, storedProtein: r.nutrition.protein, liveProtein: res.perServing.protein, div, bd: breakdown(inputs, friedHint) };
      (div > THRESHOLD ? divergent : consistent).push(rec);
    }
    divergent.sort((a, b) => b.div - a.div);

    console.log(`\n[scope] published recipes: ${recipes.length} | legacy (source=NULL, has calories): ${legacy.length}`);
    console.log(`[result] consistent (≤${pct(THRESHOLD)}): ${consistent.length} | DIVERGENT (>${pct(THRESHOLD)}): ${divergent.length} | not live-computable: ${notComputable.length}`);

    const proposals = [];
    console.log(`\n=== DIVERGENT (stored vs live, >${pct(THRESHOLD)}) — newest evidence first ===`);
    for (const r of divergent) {
      const top = r.bd[0];
      const topShare = top && r.bd.reduce((s, x) => s + x.kcal, 0) > 0 ? top.kcal / r.bd.reduce((s, x) => s + x.kcal, 0) : 0;
      const allGrounded = r.bd.every((x) => x.grounded);
      // DEFAULT verdict: the live sum is faithful to the authored ingredients → adopt it, UNLESS one big ingredient
      // dominates with a large per-serving weight (then the authored AMOUNT is the likely culprit → verify first).
      const bigSingle = top && topShare > 0.6 && top.grams / r.servings > 200;
      const verdict = bigSingle ? 'REVIEW_AMOUNT' : (allGrounded ? 'TRUST_LIVE' : 'REVIEW');
      const dir = r.live > r.stored ? 'stored UNDER-counts' : 'stored OVER-counts';
      console.log(`\n  • ${r.title}  [${r.region || '—'}]  ${r.servings} servings`);
      console.log(`      stored ${r0(r.stored)} kcal  vs  live ${r0(r.live)} kcal   (${pct(r.div)} ${dir})  → ${verdict}`);
      console.log(`      top contributors/serv: ${r.bd.slice(0, 4).map((x) => `${x.name} ${r0(x.grams / r.servings)}g=${r0(x.kcal / r.servings)}kcal[${x.source}${x.grounded ? '' : '*'}]`).join('  ')}`);
      if (bigSingle) console.log(`      ⚠ one ingredient «${top.name}» is ${pct(topShare)} of calories at ${r0(top.grams / r.servings)}g/serv — verify the authored amount before trusting either number.`);
      proposals.push({ id: r.id, title: r.title, servings: r.servings, storedKcal: r0(r.stored), liveKcal: r0(r.live), divergence: Number(r.div.toFixed(2)), verdict, proposed: verdict === 'TRUST_LIVE' ? { calories: r0(r.live), protein: r.liveProtein, source: 'estimated_ingredient_gris_v1' } : null });
    }

    if (notComputable.length) {
      console.log(`\n=== NOT LIVE-COMPUTABLE (kept as-is; can't compare) ===`);
      for (const r of notComputable) console.log(`  • ${r.title} (stored ${r0(r.stored)}) — blocked by: ${r.blockers.slice(0, 3).join(', ') || 'coverage'}`);
    }
    if (SHOW_ALL) {
      console.log(`\n=== CONSISTENT (≤${pct(THRESHOLD)} — no action) ===`);
      for (const r of consistent.sort((a, b) => b.div - a.div)) console.log(`  • ${r.title}: stored ${r0(r.stored)} ~ live ${r0(r.live)} (${pct(r.div)})`);
    }

    const trust = proposals.filter((p) => p.verdict === 'TRUST_LIVE').length;
    const review = proposals.length - trust;
    const outDir = path.resolve(__dirname, '_audit');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'legacy-nutrition-proposals.json');
    fs.writeFileSync(outFile, JSON.stringify({ generatedFrom: 'audit-legacy-nutrition.cjs', threshold: THRESHOLD, counts: { legacy: legacy.length, divergent: divergent.length, trustLive: trust, review, notComputable: notComputable.length }, proposals }, null, 2));
    console.log(`\n[summary] of ${divergent.length} divergent: ${trust} → TRUST_LIVE (propose adopt live), ${review} → need human review (amount/edge).`);
    console.log(`[written] proposals for review: ${path.relative(process.cwd(), outFile)}  (NO DB writes — propose only)`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('AUDIT ERROR:', e.message); process.exit(1); });
