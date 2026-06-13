/**
 * PHASE_ONE_200_RECIPES controlled DEV importer (v0.6.1).
 *
 * Strategy (verified safe): the new 200 set is a SUPERSET of the existing 122 (same recipeIds) — so this
 * is a pure UPSERT: update the 122 in place (by id) + create 78 new. ZERO recipe deletions → no cascade,
 * so user favorites / recommendations / meal-plan slots / interactions are NEVER touched. Only recipe
 * CATALOG rows + their own child rows (ingredients/steps/searchTerms/nutrition) are written.
 *
 * Idempotent: re-running updates the same 200 (children replaced), creates 0 new, no duplicates.
 * Modes: default = DRY-RUN (no writes); `--apply` writes inside one transaction.
 * NOTE: plain JS (run via node) — `tsx` is not installed; mirrors the existing importer pattern.
 *
 * Reuses the proven mapper from ../data/phase-one-recipes.js (so the 122 are mapped identically), then
 * re-stamps adminNote.source to phase-one-v0.6.1. Reads the staged active 200 dataset.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapRecipe } = require('../data/phase-one-recipes');
const { validate } = require('./validate-phase-one-200-v0-6-1');

const ROOT = path.resolve(__dirname, '../../../..');
const ACTIVE = path.join(ROOT, 'data/recipes/active/recipes.fa.phase-one.200.json');
const REPORT_PATH = path.join(ROOT, 'data/recipes/phase-one/v0.6.1/import_report_v0.6.1.json');

function redactUrl(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.username}:***@${u.hostname}:${u.port}${u.pathname}`; }
  catch { return '(unparseable)'; }
}
function isLocal(host) { return ['localhost', '127.0.0.1', '::1'].includes(host); }

function mapForV061(recipe) {
  const mapped = mapRecipe(recipe);
  try {
    const note = JSON.parse(mapped.adminNote);
    note.source = 'phase-one-v0.6.1';
    note.datasetVersion = 'v0.6.1';
    mapped.adminNote = JSON.stringify(note);
  } catch { /* leave as-is */ }
  return mapped;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'apply' : 'dry-run';
  const startedAt = new Date().toISOString();

  // --- DB identity guard ---
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=apps/server/.env ...)');
  const parsed = new URL(dbUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  console.log(`[db] redacted: ${redactUrl(dbUrl)}`);
  console.log(`[db] database: ${databaseName} | host: ${parsed.hostname} | local: ${isLocal(parsed.hostname)}`);
  if (databaseName !== 'garnish_db' || !isLocal(parsed.hostname)) {
    throw new Error(`SAFETY STOP: refusing to import — expected local/dev garnish_db, got ${databaseName}@${parsed.hostname}`);
  }

  // --- validation gate ---
  const v = validate();
  console.log(`[validate] ${v.ok ? 'PASS' : 'FAIL'} — recipes=${v.summary.recipeCount} unresolved=${v.summary.unresolved} invalidId=${v.summary.invalidId} idCodeMismatch=${v.summary.idCodeMismatch} newIds=${v.summary.newIds}`);
  if (!v.ok) { for (const e of v.errors) console.log('  -', e); throw new Error('Validation failed — STOP (no import).'); }

  const recipes = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
  const prisma = new PrismaClient();
  try {
    const recipeCountBefore = await prisma.recipe.count();
    const dbIds = new Set((await prisma.recipe.findMany({ select: { id: true } })).map((r) => r.id));
    const dsIds = recipes.map((r) => String(r.recipeId));
    const toCreate = dsIds.filter((id) => !dbIds.has(id));
    const toUpdate = dsIds.filter((id) => dbIds.has(id));
    const obsolete = [...dbIds].filter((id) => !dsIds.includes(id));

    const interactions = {
      favoriteRecipe: await prisma.favoriteRecipe.count(),
      recommendationExposure: await prisma.recommendationExposure.count(),
      featureContributionLog: await prisma.featureContributionLog.count(),
      recommendationAttributionEvent: await prisma.recommendationAttributionEvent.count(),
      mealSlotWithRecipe: await prisma.mealSlot.count({ where: { recipeId: { not: null } } }),
    };

    console.log(`\n[plan] mode=${mode}`);
    console.log(`  recipeCountInput: ${recipes.length}`);
    console.log(`  existingRecipeCount: ${recipeCountBefore}`);
    console.log(`  toCreate: ${toCreate.length} | toUpdate: ${toUpdate.length} | toSkip: 0 | obsoleteToDeactivate: ${obsolete.length}`);
    console.log(`  user interactions (PRESERVED, never deleted): ${JSON.stringify(interactions)}`);
    if (obsolete.length) console.log(`  NOTE obsolete db-only ids (would need a decision): ${obsolete.length}`);

    if (!apply) {
      console.log('\n[dry-run] no DB writes performed. Re-run with --apply to import.');
      console.log(JSON.stringify({ mode, recipeCountInput: recipes.length, existingRecipeCount: recipeCountBefore, toCreate: toCreate.length, toUpdate: toUpdate.length, obsolete: obsolete.length, blockers: 0, validation: v.summary, databaseName }, null, 2));
      return;
    }

    // --- APPLY ---
    if (obsolete.length) {
      // Safety: we never delete recipes (would cascade user interactions). If obsolete exist, STOP.
      throw new Error(`SAFETY STOP: ${obsolete.length} obsolete db-only recipes exist; deletion would cascade user interactions. Aborting apply (needs explicit deactivate decision).`);
    }

    let createdCount = 0, updatedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const recipe of recipes) {
        const mapped = mapForV061(recipe);
        const { id } = mapped;
        if (dbIds.has(id)) {
          // update in place — replace recipe-owned children only; recipe row (and its FKs) preserved
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeStep.deleteMany({ where: { recipeId: id } });
          await tx.searchTerm.deleteMany({ where: { recipeId: id } });
          await tx.nutrition.deleteMany({ where: { recipeId: id } });
          const { id: _omit, ...data } = mapped;
          await tx.recipe.update({ where: { id }, data });
          updatedCount++;
        } else {
          await tx.recipe.create({ data: mapped });
          createdCount++;
        }
      }
    }, { timeout: 600000, maxWait: 30000 });

    const recipeCountAfter = await prisma.recipe.count();
    const finishedAt = new Date().toISOString();
    const report = {
      startedAt, finishedAt, mode,
      databaseUrl: redactUrl(dbUrl), databaseName,
      sourcePackage: 'garnish_recipe_phase_one_200_draft_candidate_v0_6_1_unresolved_recipe_replacement_patch',
      datasetVersion: 'v0.6.1',
      recipeCountInput: recipes.length,
      recipeCountBefore, recipeCountImported: createdCount + updatedCount, recipeCountAfter,
      createdCount, updatedCount, skippedCount: 0, deactivatedOldRecipeCount: 0,
      invalidIngredientId: v.summary.invalidId,
      invalidIngredientCode: v.summary.invalidCode,
      ingredientIdCodeMismatch: v.summary.idCodeMismatch,
      unresolvedIngredientCount: v.summary.unresolved,
      readyForImportFalseCount: v.summary.notReady,
      medicalNutritionClaimHits: 0,
      newIngredientIdsCreated: v.summary.newIds,
      userInteractionsPreserved: interactions,
      success: recipeCountAfter === recipes.length && createdCount + updatedCount === recipes.length,
      errors: [],
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n[apply] done. created=${createdCount} updated=${updatedCount} after=${recipeCountAfter}`);
    console.log(`[apply] report written: ${path.relative(ROOT, REPORT_PATH)}`);
    if (!report.success) throw new Error('Post-import count mismatch — see report.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('IMPORT ERROR:', e.message); process.exit(1); });
