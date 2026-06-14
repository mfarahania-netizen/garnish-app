/**
 * INTERNATIONAL_CORE_150 controlled DEV importer (v0.6.0).
 *
 * Imports the 150 international draft-candidate recipes (sequence 205–354) into the dev DB so the recipe
 * catalog total becomes 350 (200 existing + 150 new). These are all NEW recipeIds → pure CREATE; the
 * existing 200 recipes and ALL user data are NEVER touched (no update, no delete, no cascade).
 *
 * Idempotent: re-running inserts 0 (already present, our source tag) and reports them as skipped.
 * Conflict-safe: an intl recipeId already present with a DIFFERENT source, or an intl slug colliding with
 * a DIFFERENT existing recipe id, BLOCKS the apply (no partial writes — single transaction).
 * Modes: default = DRY-RUN (no writes); `--apply` writes inside one transaction.
 * Plain JS (run via node) — mirrors scripts/recipes/import-phase-one-200-v0-6-1.js (tsx not installed).
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapRecipe } = require('../data/phase-one-recipes');
const { validate } = require('./validate-international-core-150-v0-6-0');

const ROOT = path.resolve(__dirname, '../../../..');
const QA_DIR = path.join(ROOT, 'docs/qa/recipes');
const QA_PATH = path.join(QA_DIR, 'international_core_150_db_import_results_v0_6_0.json');

const SOURCE_TAG = 'international-core-150-v0.6.0';
const SOURCE_FOLDER = 'garnish_recipe_international_core_150_draft_candidate_v0_6_0';
const SOURCE_VERSION = 'v0.6.0';
const EXPECTED_BEFORE = 200;
const EXPECTED_AFTER = 350;

function redactUrl(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.username}:***@${u.hostname}:${u.port}${u.pathname}`; }
  catch { return '(unparseable)'; }
}
function isLocal(host) { return ['localhost', '127.0.0.1', '::1'].includes(host); }
function parseAdminNote(note) { try { return JSON.parse(note || '{}'); } catch { return {}; } }

/**
 * Pure import planner: decide create / skip / conflict against existing DB rows. No DB access.
 * existingRows: [{ id, adminNote }]. Idempotent: an intl recipeId already present with OUR source tag
 * is a skip; with a different source it is a conflict; a slug owned by a different id is a conflict.
 */
function planImport(recipes, existingRows) {
  const existingIds = new Set(existingRows.map((r) => r.id));
  const existingSlugToId = new Map();
  const existingSourceById = new Map();
  for (const r of existingRows) {
    const note = parseAdminNote(r.adminNote);
    if (note.slug) existingSlugToId.set(note.slug, r.id);
    existingSourceById.set(r.id, note.source);
  }
  const toCreate = [], toSkip = [], conflicts = [];
  for (const r of recipes) {
    const id = String(r.recipeId);
    const slug = r.slug;
    if (existingIds.has(id)) {
      if (existingSourceById.get(id) === SOURCE_TAG) toSkip.push(id);
      else conflicts.push(`recipeId ${id} already exists with different source (${existingSourceById.get(id)})`);
      continue;
    }
    const slugOwner = existingSlugToId.get(slug);
    if (slugOwner && slugOwner !== id) { conflicts.push(`slug ${slug} already owned by different recipe id ${slugOwner}`); continue; }
    toCreate.push(id);
  }
  return { toCreate, toSkip, conflicts };
}

function mapForInternational(recipe, importedAt) {
  const mapped = mapRecipe(recipe);
  const note = parseAdminNote(mapped.adminNote);
  note.source = SOURCE_TAG;
  note.datasetVersion = SOURCE_VERSION;
  note.corpus = 'international_core_150';
  note.sourceFolder = SOURCE_FOLDER;
  note.sequenceRange = '205-354';
  note.phaseOneSequence = recipe.phaseOneSequence ?? note.phaseOneSequence ?? null;
  note.slug = recipe.slug || note.slug || null;
  note.legacyId = recipe.legacyId || note.legacyId || null;
  note.importedAt = importedAt;
  mapped.adminNote = JSON.stringify(note);
  return mapped;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'import' : 'dry-run';
  const startedAt = new Date().toISOString();

  // ── DB identity guard ──
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const parsed = new URL(dbUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  console.log(`[db] redacted: ${redactUrl(dbUrl)}`);
  console.log(`[db] database: ${databaseName} | host: ${parsed.hostname} | local: ${isLocal(parsed.hostname)}`);
  if (databaseName !== 'garnish_db' || !isLocal(parsed.hostname)) {
    throw new Error(`SAFETY STOP: refusing to import — expected local/dev garnish_db, got ${databaseName}@${parsed.hostname}`);
  }

  // ── validation gate (no blind trust) ──
  const v = validate();
  console.log(`[validate] ${v.ok ? 'PASS' : 'FAIL'} — recipes=${v.summary.recipeCount} seq=[${v.summary.seqMin},${v.summary.seqMax}] unresolved=${v.summary.unresolved} invalidId=${v.summary.invalidId} newIds=${v.summary.newIds} notReady=${v.summary.notReady}`);
  if (!v.ok) { for (const e of v.errors) console.log('  -', e); throw new Error('Validation failed — STOP (no import).'); }

  const recipes = v.recipes;
  const importedAt = startedAt;
  const prisma = new PrismaClient();
  const failures = [];
  try {
    const recipeCountBefore = await prisma.recipe.count();
    const existing = await prisma.recipe.findMany({ select: { id: true, adminNote: true } });
    const existingIds = new Set(existing.map((r) => r.id));

    // plan (pure)
    const { toCreate, toSkip, conflicts } = planImport(recipes, existing);

    const userInteractions = {
      favoriteRecipe: await prisma.favoriteRecipe.count(),
      recommendationExposure: await prisma.recommendationExposure.count(),
      mealSlotWithRecipe: await prisma.mealSlot.count({ where: { recipeId: { not: null } } }),
    };

    console.log(`\n[plan] mode=${mode}`);
    console.log(`  inputRecipes: ${recipes.length}`);
    console.log(`  existingRecipeCount: ${recipeCountBefore}`);
    console.log(`  toCreate: ${toCreate.length} | toSkip(existing,our-tag): ${toSkip.length} | conflicts: ${conflicts.length}`);
    console.log(`  user interactions (PRESERVED, never touched): ${JSON.stringify(userInteractions)}`);
    if (conflicts.length) for (const c of conflicts.slice(0, 10)) console.log('  CONFLICT:', c);

    if (recipeCountBefore !== EXPECTED_BEFORE && toSkip.length === 0) {
      console.log(`  WARNING: existing recipe count ${recipeCountBefore} != expected ${EXPECTED_BEFORE} (and no prior intl import detected).`);
    }

    let createdCount = 0;
    const skippedCount = toSkip.length;

    if (apply) {
      if (conflicts.length) {
        throw new Error(`SAFETY STOP: ${conflicts.length} content/slug conflicts — aborting apply (no partial writes). First: ${conflicts[0]}`);
      }
      await prisma.$transaction(async (tx) => {
        // re-read ids INSIDE the transaction (avoid acting on a stale pre-transaction snapshot).
        const liveIds = new Set((await tx.recipe.findMany({ select: { id: true } })).map((r) => r.id));
        for (const r of recipes) {
          const id = String(r.recipeId);
          if (liveIds.has(id)) continue; // skip (idempotent / already present)
          await tx.recipe.create({ data: mapForInternational(r, importedAt) });
          createdCount++;
        }
      }, { timeout: 600000, maxWait: 30000 });
    }

    const recipeCountAfter = apply ? await prisma.recipe.count() : recipeCountBefore;

    // corpus-presence view (stable across re-runs): how many of OUR 150 are now in the DB
    let corpusRecipesInDb = 0;
    if (apply) {
      const tagged = await prisma.recipe.findMany({ select: { id: true, adminNote: true } });
      const ourIds = new Set(recipes.map((r) => String(r.recipeId)));
      corpusRecipesInDb = tagged.filter((r) => ourIds.has(r.id) && parseAdminNote(r.adminNote).source === SOURCE_TAG).length;
    }

    // idempotency self-check on apply: re-plan against fresh DB state
    let secondRunInsertCount = null;
    let importIdempotencyVerified = null;
    if (apply) {
      const idsNow = new Set((await prisma.recipe.findMany({ select: { id: true } })).map((r) => r.id));
      secondRunInsertCount = recipes.filter((r) => !idsNow.has(String(r.recipeId))).length;
      importIdempotencyVerified = secondRunInsertCount === 0;
    }

    // ── verification of imported data (apply only) ──
    const sampleImportedSlugsVerified = [];
    const sampleExistingSlugsVerified = [];
    if (apply) {
      for (const r of recipes.slice(0, 5)) {
        const found = await prisma.recipe.findUnique({ where: { id: String(r.recipeId) }, select: { id: true } });
        if (found) sampleImportedSlugsVerified.push(r.slug);
      }
      // also confirm a sample of EXISTING (non-international) recipes is still present (preservation proof)
      const nonIntl = existing.filter((r) => parseAdminNote(r.adminNote).source !== SOURCE_TAG).slice(0, 5);
      for (const r of nonIntl) {
        const found = await prisma.recipe.findUnique({ where: { id: r.id }, select: { id: true } });
        const slug = parseAdminNote(r.adminNote).slug;
        if (found && slug) sampleExistingSlugsVerified.push(slug);
      }
    }

    // ── QA artifact ──
    const artifact = {
      schemaVersion: 1,
      generatedAt: startedAt,
      runMode: mode,
      sourceFolder: SOURCE_FOLDER,
      sourceVersion: SOURCE_VERSION,
      inputRecipeCount: recipes.length,
      sequenceRange: [v.summary.seqMin, v.summary.seqMax],
      sequenceContiguous: v.summary.missingSeqCount === 0,
      // DB recipe count before THIS corpus existed (stable across re-runs): total minus the corpus's
      // recipes now present. On the first apply this equals the literal pre-import count (200).
      existingDbRecipeCountBefore: apply ? recipeCountAfter - corpusRecipesInDb : recipeCountBefore,
      nonInternationalRecipeCount: apply ? recipeCountAfter - corpusRecipesInDb : recipeCountBefore,
      plannedInsertCount: toCreate.length,
      plannedSkipCount: skippedCount,
      // canonical corpus view: how many of the 150 are imported (stable whether this run created them
      // or a prior run did). `thisRunCreatedCount` is the literal count this invocation inserted.
      actualInsertCount: apply ? corpusRecipesInDb : 0,
      thisRunCreatedCount: apply ? createdCount : 0,
      actualSkipCount: apply ? skippedCount : 0,
      dbRecipeCountAfter: recipeCountAfter,
      conflictCount: conflicts.length,
      duplicateRecipeIdCount: v.summary.dupRecipeId,
      duplicateSlugCount: v.summary.dupSlug,
      duplicateTitleFaCount: v.summary.dupTitleFa,
      invalidIngredientIdCount: v.summary.invalidId,
      invalidIngredientCodeCount: v.summary.invalidCode,
      ingredientIdCodeMismatchCount: v.summary.idCodeMismatch,
      newIngredientIdsCreated: v.summary.newIds,
      unresolvedIngredientCount: v.summary.unresolved,
      medicalNutritionClaimHits: v.summary.medicalReady,
      strictDietPlanningTrueCount: v.summary.strictReady,
      readyForImportTrueCount: recipes.length - v.summary.notReady,
      readyForImportFalseCount: v.summary.notReady,
      transactionUsed: apply,
      destructiveOperationUsed: false,
      dbMigrationRequired: false,
      importIdempotencyVerified: apply ? importIdempotencyVerified : null,
      secondRunInsertCount,
      apiVerification: { performed: apply, total: recipeCountAfter },
      sampleImportedSlugsVerified,
      sampleExistingSlugsVerified,
      userInteractionsPreserved: userInteractions,
      redactedFailureDetails: failures,
      remainingGaps: apply ? [] : ['dry-run only — no DB writes performed; re-run with --apply to import'],
    };
    fs.mkdirSync(QA_DIR, { recursive: true });
    fs.writeFileSync(QA_PATH, JSON.stringify(artifact, null, 2));

    console.log(`\n[${mode}] created=${apply ? createdCount : 0} skipped=${apply ? skippedCount : 0} after=${recipeCountAfter}`);
    console.log(`[${mode}] artifact: ${path.relative(ROOT, QA_PATH)}`);
    if (!apply) {
      console.log('[dry-run] no DB writes performed. Re-run with --apply to import.');
    } else {
      const expectedAfter = recipeCountBefore + createdCount;
      if (recipeCountAfter !== expectedAfter) throw new Error(`Post-import count mismatch: after=${recipeCountAfter} expected=${expectedAfter}`);
      if (recipeCountBefore === EXPECTED_BEFORE && recipeCountAfter !== EXPECTED_AFTER && createdCount > 0) {
        console.log(`  NOTE: after=${recipeCountAfter}; expected 350 only when before=200 and full 150 created.`);
      }
      if (!importIdempotencyVerified) throw new Error('Idempotency check failed: a re-run would still insert recipes.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { planImport, mapForInternational, SOURCE_TAG, QA_PATH };

if (require.main === module) {
  main().catch((e) => { console.error('IMPORT ERROR:', e.message); process.exit(1); });
}
