/**
 * S3 Option-2 — STRUCTURED RICHNESS backfill (v0.6.1 active 200, DEV).
 *
 * Why a backfill and NOT a re-import: the active-200 importer (import-phase-one-200-v0-6-1.js) refuses to
 * `--apply` while the DRAFT International-Core-150 is present (150 "obsolete" ids → its SAFETY STOP fires, to
 * avoid cascading user data). So to populate the new structured columns on the existing 200 rows WITHOUT
 * touching the draft 150 or any safety field, this script does a PURE, ADDITIVE UPDATE of only the five new
 * columns (chefTips / commonMistakes / servingSuggestions / substitutions / dishType), keyed by id, for the
 * 200 active ids only. NO deletes, NO child writes, NO cascade, the 150 untouched.
 *
 * Safety: snapshots the safety-relevant fields (allergens, diet, categories, ingredient name+ingredientId)
 * for the 200 INSIDE the transaction, before and after; if anything but the five new columns changed, it
 * THROWS → the transaction rolls back. Idempotent. Default = DRY-RUN; `--apply` writes. Local garnish_db only.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapRecipe } = require('../data/phase-one-recipes');

const ROOT = path.resolve(__dirname, '../../../..');
const ACTIVE = path.join(ROOT, 'data/recipes/active/recipes.fa.phase-one.200.json');
const NEW_COLS = ['chefTips', 'commonMistakes', 'servingSuggestions', 'substitutions', 'dishType'];

function redactUrl(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.username}:***@${u.hostname}:${u.port}${u.pathname}`; }
  catch { return '(unparseable)'; }
}
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);

async function main() {
  const apply = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(dbUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  console.log(`[db] ${redactUrl(dbUrl)} | database: ${databaseName} | local: ${isLocal(parsed.hostname)}`);
  if (databaseName !== 'garnish_db' || !isLocal(parsed.hostname)) {
    throw new Error(`SAFETY STOP: expected local/dev garnish_db, got ${databaseName}@${parsed.hostname}`);
  }

  const recipes = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
  const ids = recipes.map((r) => String(r.recipeId));
  const prisma = new PrismaClient();
  // safety-relevant snapshot of the 200 (everything the allergy/diet path reads) — must be byte-identical
  const snapshot = (tx) =>
    tx.recipe
      .findMany({
        where: { id: { in: ids } },
        select: { id: true, allergens: true, diet: true, categories: true, ingredients: { select: { name: true, ingredientId: true, order: true }, orderBy: { order: 'asc' } } },
        orderBy: { id: 'asc' },
      })
      .then((rows) => JSON.stringify(rows));

  try {
    const present = new Set((await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id));
    const missing = ids.filter((id) => !present.has(id));
    console.log(`[plan] active-200 ids=${ids.length} | present in DB=${present.size} | missing=${missing.length} | mode=${apply ? 'apply' : 'dry-run'}`);
    if (missing.length) console.log(`[plan] NOTE ${missing.length} active ids not yet in DB — they are SKIPPED (backfill never creates).`);

    if (!apply) {
      console.log('[dry-run] no writes. Re-run with --apply to backfill the five new columns.');
      return;
    }

    let updated = 0;
    let safetyEqual = false;
    await prisma.$transaction(async (tx) => {
      const before = await snapshot(tx);
      for (const recipe of recipes) {
        const m = mapRecipe(recipe);
        if (!present.has(m.id)) continue; // never create; backfill existing rows only
        await tx.recipe.update({ where: { id: m.id }, data: { chefTips: m.chefTips, commonMistakes: m.commonMistakes, servingSuggestions: m.servingSuggestions, substitutions: m.substitutions, dishType: m.dishType } });
        updated++;
      }
      const after = await snapshot(tx);
      safetyEqual = before === after;
      if (!safetyEqual) throw new Error('SAFETY EQUIVALENCE FAILED — a safety-relevant field changed; rolling back. (Backfill must only write the five new columns.)');
    }, { timeout: 600000, maxWait: 30000 });

    console.log(`[apply] updated=${updated} columns=${NEW_COLS.join(',')}`);
    console.log(`[apply] SAFETY EQUIVALENCE (allergens/diet/categories/ingredients byte-identical pre/post): ${safetyEqual ? 'PASS' : 'FAIL'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('BACKFILL ERROR:', e.message); process.exit(1); });
