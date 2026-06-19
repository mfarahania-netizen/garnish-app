/**
 * SCALE-269 APPLY — write the USDA-verified enrichment for the 258 passed used-ingredients (DEV).
 *
 * Reads scale-269-proposed.json (verdict==='pass' records). For each:
 *   - if finalNutrition present (227): set nutritionPer100g + nutritionConfidence='source_locked_verified_for_general_use'.
 *   - if finalNutrition null (31 — flavored waters, spice/herb mixes, brand pastes): nutrition left UNTOUCHED
 *     (no fake numbers), only substitutions are locked.
 *   - always: set substitutionOptions to the curated [{name,reason}] (replaces old garbage; empty array is valid
 *     and authoritative for source-locked items, e.g. turmeric/cinnamon have no real swap).
 *
 * Safety: snapshots allergens + dietFlags of all touched ids INSIDE the transaction, before and after; they must
 * be byte-identical (this pass never touches them) — else THROW → rollback. Default DRY-RUN; `--apply` writes. Local only.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
const SOURCE = path.join(ROOT, 'apps/server/scripts/data/_pilot/scale-269-proposed.json');
const LOCK = 'source_locked_verified_for_general_use';

const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
const toSubs = (r) => (Array.isArray(r.substitutions) ? r.substitutions : [])
  .map((s) => (typeof s === 'string' ? { name: s, reason: '' } : { name: s && s.name, reason: (s && s.reason) || '' }))
  .filter((s) => s.name);

async function main() {
  const apply = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(dbUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error(`SAFETY STOP: expected local garnish_db, got ${dbName}@${parsed.hostname}`);

  const all = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const records = all.filter((r) => r && r.verdict === 'pass');
  const ids = [...new Set(records.map((r) => r.ingredientId))];
  const withNut = records.filter((r) => r.finalNutrition).length;
  console.log(`[plan] records=${all.length} | pass=${records.length} | unique ids=${ids.length} | with-nutrition=${withNut} | null-nutrition=${records.length - withNut} | mode=${apply ? 'apply' : 'dry-run'}`);

  const prisma = new PrismaClient();
  // safety snapshot — allergy/diet-critical fields must NOT change in this pass
  const snapshot = (tx) => tx.ingredient
    .findMany({ where: { id: { in: ids } }, select: { id: true, allergens: true, dietFlags: true }, orderBy: { id: 'asc' } })
    .then((rows) => JSON.stringify(rows));

  try {
    const present = new Set((await prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id));
    const missing = ids.filter((id) => !present.has(id));
    if (missing.length) console.log(`[plan] NOTE not in DB (skipped): ${missing.length}`);

    if (!apply) {
      console.log('[dry-run] sample of what will be written:');
      for (const r of records.slice(0, 6)) {
        console.log(`  • ${r.nameFa}: ${r.finalNutrition ? r.finalNutrition.calories + 'kcal (locked)' : 'nutrition untouched'} | subs: ${toSubs(r).map((s) => s.name).join('، ') || '—'}`);
      }
      console.log('[dry-run] no writes. Re-run with --apply.');
      return;
    }

    let nutritionUpdated = 0; let subsUpdated = 0; let safetyEqual = false;
    await prisma.$transaction(async (tx) => {
      const before = await snapshot(tx);
      for (const r of records) {
        if (!present.has(r.ingredientId)) continue;
        const data = { substitutionOptions: toSubs(r) };
        if (r.finalNutrition) {
          data.nutritionPer100g = r.finalNutrition;
          data.nutritionConfidence = LOCK;
          nutritionUpdated++;
        }
        await tx.ingredient.update({ where: { id: r.ingredientId }, data });
        subsUpdated++;
      }
      const after = await snapshot(tx);
      safetyEqual = before === after;
      if (!safetyEqual) throw new Error('SAFETY EQUIVALENCE FAILED — allergens/dietFlags changed; rolling back.');
    }, { timeout: 300000, maxWait: 30000 });

    console.log(`[apply] ingredients updated=${subsUpdated} | nutrition source-locked=${nutritionUpdated}`);
    console.log(`[apply] SAFETY EQUIVALENCE (allergens + dietFlags byte-identical pre/post): ${safetyEqual ? 'PASS' : 'FAIL'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('APPLY ERROR:', e.message); process.exit(1); });
