/**
 * PILOT APPLY — write the 12 USDA-verified ingredients from the enrichment pilot (DEV).
 *
 * Reads apps/server/scripts/data/_pilot/pilot-proposed.json and, for each record with verdict==='pass'
 * and a finalNutrition, PURE-UPDATEs three fields on that ingredient:
 *   - nutritionPer100g        ← the USDA-sourced (verifier-corrected if needed) per-100g values
 *   - nutritionConfidence     ← 'source_locked_verified_for_general_use' (joins the existing 17)
 *   - substitutionOptions     ← the verified, curated same-role swaps [{name,reason}] (replaces old garbage)
 * PLUS one deliberate SAFETY correction: «کره بدون نمک» dietFlags had `vegan` + `dairy_free` while it
 * carries the `milk` allergen — we strip those two false flags.
 *
 * Safety: snapshots the allergy/diet-critical fields INSIDE the transaction, before and after. Allergens of
 * all 12 must be byte-identical; dietFlags of every ingredient EXCEPT butter must be byte-identical (butter
 * is the one intended change). Anything else → THROW → rollback. Default DRY-RUN; `--apply` writes. Local only.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
const SOURCE = path.join(ROOT, 'apps/server/scripts/data/_pilot/pilot-proposed.json');
const BUTTER_ID = 'ing_butter_unsalted';
const BUTTER_DIETFLAGS_FIXED = ['gluten_free', 'halal', 'keto_friendly', 'vegetarian']; // removed: dairy_free, vegan

const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);

async function main() {
  const apply = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(dbUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error(`SAFETY STOP: expected local garnish_db, got ${dbName}@${parsed.hostname}`);

  const all = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const records = all.filter((r) => r && r.verdict === 'pass' && r.finalNutrition);
  const ids = [...new Set(records.map((r) => r.ingredientId))];
  console.log(`[plan] proposed=${all.length} | apply-eligible(pass+nutrition)=${records.length} | unique ids=${ids.length} | mode=${apply ? 'apply' : 'dry-run'}`);

  const toSubs = (r) => (Array.isArray(r.substitutions) ? r.substitutions : [])
    .map((s) => (typeof s === 'string' ? { name: s, reason: '' } : { name: s?.name, reason: s?.reason || '' }))
    .filter((s) => s.name);

  const prisma = new PrismaClient();
  // allergy/diet-critical snapshot (must stay byte-identical except butter.dietFlags)
  const snapshot = (tx) => tx.ingredient
    .findMany({ where: { id: { in: ids } }, select: { id: true, allergens: true, dietFlags: true }, orderBy: { id: 'asc' } })
    .then((rows) => JSON.stringify(rows.map((x) => ({ id: x.id, allergens: x.allergens, dietFlags: x.id === BUTTER_ID ? '<<intended-change>>' : x.dietFlags }))));

  try {
    const present = new Set((await prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id));
    const missing = ids.filter((id) => !present.has(id));
    if (missing.length) console.log(`[plan] NOTE not in DB (skipped): ${missing.join(', ')}`);

    console.log('[preview]');
    for (const r of records) {
      const subs = toSubs(r).map((s) => s.name);
      console.log(`  • ${r.nameFa} (${r.ingredientId}): ${r.finalNutrition.calories}kcal | subs: ${subs.length ? subs.join('، ') : '—'}${r.ingredientId === BUTTER_ID ? ' | + dietFlags safety fix' : ''}`);
    }

    if (!apply) { console.log('[dry-run] no writes. Re-run with --apply.'); return; }

    let updated = 0; let safetyEqual = false;
    await prisma.$transaction(async (tx) => {
      const before = await snapshot(tx);
      for (const r of records) {
        if (!present.has(r.ingredientId)) continue;
        const data = {
          nutritionPer100g: r.finalNutrition,
          nutritionConfidence: 'source_locked_verified_for_general_use',
          substitutionOptions: toSubs(r),
        };
        if (r.ingredientId === BUTTER_ID) data.dietFlags = BUTTER_DIETFLAGS_FIXED;
        await tx.ingredient.update({ where: { id: r.ingredientId }, data });
        updated++;
      }
      const after = await snapshot(tx);
      safetyEqual = before === after;
      if (!safetyEqual) throw new Error('SAFETY EQUIVALENCE FAILED — allergens or a non-butter dietFlags changed; rolling back.');
    }, { timeout: 120000, maxWait: 30000 });

    console.log(`[apply] updated=${updated}`);
    console.log(`[apply] SAFETY EQUIVALENCE (allergens all + dietFlags except butter, byte-identical): ${safetyEqual ? 'PASS' : 'FAIL'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('APPLY ERROR:', e.message); process.exit(1); });
