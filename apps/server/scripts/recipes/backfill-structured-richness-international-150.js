/**
 * S3 Option-2 — STRUCTURED RICHNESS backfill for the International-Core-150 (DEV).
 *
 * Why: the 150 international recipes were imported with the OLD mapper, which flattened their richness into
 * the merged `tips` blob (with English "Common mistake:" / "Substitution:" prefixes leaking) and left the
 * structured columns EMPTY. So the recipe-detail UI falls back to the merged-tips accordion and shows the
 * English prefixes instead of the clean «نکات سرآشپز / اشتباهات رایج / پیشنهاد سرو / جایگزین‌ها» sections that
 * the active-200 already show. (The active-200 got this via backfill-structured-richness-v0-6-1.js.)
 *
 * This mirrors that proven backfill EXACTLY, only the SOURCE differs: it re-runs the CURRENT mapRecipe over
 * the 150 source and does a PURE, ADDITIVE UPDATE of just the five structured columns
 * (chefTips / commonMistakes / servingSuggestions / substitutions / dishType), keyed by id, for the 150 ids
 * only. NO deletes, NO child writes, NO cascade, the active-200 untouched.
 *
 * Safety: snapshots the safety-relevant fields (allergens, diet, categories, ingredient name+ingredientId)
 * for the 150 INSIDE the transaction, before and after; if anything but the five columns changed, it THROWS
 * → the transaction rolls back. Idempotent. Default = DRY-RUN; `--apply` writes. Local garnish_db only.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapRecipe } = require('../data/phase-one-recipes');

const ROOT = path.resolve(__dirname, '../../../..');
const SOURCE = path.join(ROOT, 'garnish_recipe_international_core_150_draft_candidate_v0_6_0/recipes.international.core-150.draft-candidate.v0.6.0.json');
const NEW_COLS = ['chefTips', 'commonMistakes', 'servingSuggestions', 'substitutions', 'dishType'];

function redactUrl(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.username}:***@${u.hostname}:${u.port}${u.pathname}`; }
  catch { return '(unparseable)'; }
}
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);

function loadRecipes(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(raw)) return raw;
  return raw.recipes || raw.data || raw.items || [];
}

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

  const recipes = loadRecipes(SOURCE);
  const ids = recipes.map((r) => String(r.recipeId));
  console.log(`[source] ${path.basename(SOURCE)} | recipes=${recipes.length}`);
  const prisma = new PrismaClient();
  // safety-relevant snapshot of the 150 (everything the allergy/diet path reads) — must be byte-identical
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
    console.log(`[plan] international-150 ids=${ids.length} | present in DB=${present.size} | missing=${missing.length} | mode=${apply ? 'apply' : 'dry-run'}`);
    if (missing.length) console.log(`[plan] NOTE ${missing.length} ids not in DB — SKIPPED (backfill never creates).`);

    // dry-run insight: how many would gain non-empty structured richness
    let wouldFill = 0;
    for (const recipe of recipes) {
      const m = mapRecipe(recipe);
      if (!present.has(m.id)) continue;
      if ((m.chefTips && m.chefTips !== '[]') || (m.commonMistakes && m.commonMistakes !== '[]') || (m.servingSuggestions && m.servingSuggestions !== '[]') || (m.substitutions && m.substitutions !== '[]')) wouldFill++;
    }
    console.log(`[plan] recipes that will gain ≥1 non-empty structured field: ${wouldFill}`);

    if (!apply) {
      console.log('[dry-run] no writes. Re-run with --apply to backfill the five structured columns.');
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
      if (!safetyEqual) throw new Error('SAFETY EQUIVALENCE FAILED — a safety-relevant field changed; rolling back. (Backfill must only write the five structured columns.)');
    }, { timeout: 600000, maxWait: 30000 });

    console.log(`[apply] updated=${updated} columns=${NEW_COLS.join(',')}`);
    console.log(`[apply] SAFETY EQUIVALENCE (allergens/diet/categories/ingredients byte-identical pre/post): ${safetyEqual ? 'PASS' : 'FAIL'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('BACKFILL ERROR:', e.message); process.exit(1); });
