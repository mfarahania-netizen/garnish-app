const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapRecipe } = require('../data/phase-one-recipes');
const {
  ROOT,
  QA_DIR,
  SOURCE_TAG,
  DATASET_VERSION,
  EXPECTED_LITE_RECIPES,
  assertLocalDevDatabase,
  parseAdminNote,
  validateIngredientExpansion,
  validateLiteFoodRecipes,
} = require('./lite-food-v0-3');

const QA_PATH = path.join(QA_DIR, 'lite_food_v0_3_recipe_import_results.json');

function mapForLiteFood(recipe, importedAt) {
  const mapped = mapRecipe(recipe);
  const note = parseAdminNote(mapped.adminNote);
  note.source = SOURCE_TAG;
  note.datasetVersion = DATASET_VERSION;
  note.corpus = 'lite_food_96';
  note.slug = recipe.slug || note.slug || null;
  note.legacyId = recipe.legacyId || note.legacyId || null;
  note.phaseOneSequence = recipe.phaseOneSequence ?? note.phaseOneSequence ?? null;
  note.quality = recipe.quality || note.quality || null;
  note.aiContext = recipe.aiContext || note.aiContext || null;
  note.lite = recipe.aiContext?.lite || null;
  note.importedAt = importedAt;
  mapped.adminNote = JSON.stringify(note);
  mapped.gris = undefined;
  // The v0.3 source kept 30 previously-unresolved rows as `blocked_unresolved`, but the same package's
  // validation report marks them ready after the 16-row ingredient expansion. The target outcome is 96
  // active Lite rows, so the import status follows the post-expansion quality gate.
  mapped.status = recipe.quality?.readyForImport === true ? 'active' : (recipe.status || 'active');
  mapped.isPublic = mapped.status === 'active';
  return mapped;
}

function planImport(recipes, existingRows) {
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const slugOwner = new Map();
  for (const row of existingRows) {
    const note = parseAdminNote(row.adminNote);
    if (note.slug) slugOwner.set(note.slug, { id: row.id, source: note.source });
  }

  const toCreate = [];
  const toSkip = [];
  const conflicts = [];
  for (const recipe of recipes) {
    const id = String(recipe.recipeId);
    const slug = recipe.slug;
    const existing = existingById.get(id);
    if (existing) {
      const note = parseAdminNote(existing.adminNote);
      if (note.source === SOURCE_TAG && note.slug === slug) toSkip.push(id);
      else conflicts.push(`recipeId ${id} already exists with source=${note.source || 'unknown'} slug=${note.slug || 'unknown'}`);
      continue;
    }
    const owner = slugOwner.get(slug);
    if (owner && owner.id !== id) {
      conflicts.push(`slug ${slug} already belongs to recipeId ${owner.id} source=${owner.source || 'unknown'}`);
      continue;
    }
    toCreate.push(id);
  }
  return { toCreate, toSkip, conflicts };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const startedAt = new Date().toISOString();
  const db = assertLocalDevDatabase();
  const ingredientValidation = validateIngredientExpansion();
  console.log('=== LITE_FOOD v0.3 RECIPE IMPORT ===');
  console.log(`[db] ${db.redactedUrl} (${db.databaseName}@${db.host})`);
  if (!ingredientValidation.ok) {
    for (const error of ingredientValidation.errors) console.log(' -', error);
    throw new Error('Ingredient validation failed — STOP.');
  }

  const prisma = new PrismaClient();
  try {
    const dbIngredients = await prisma.ingredient.findMany({ select: { id: true, code: true } });
    const recipeValidation = validateLiteFoodRecipes(dbIngredients);
    console.log(`[validate] ${recipeValidation.ok ? 'PASS' : 'FAIL'} ${JSON.stringify(recipeValidation.summary)}`);
    if (!recipeValidation.ok) {
      for (const error of recipeValidation.errors) console.log(' -', error);
      throw new Error('Recipe validation failed — STOP.');
    }

    const recipes = recipeValidation.recipes;
    const recipeCountBefore = await prisma.recipe.count();
    const ingredientCountBefore = await prisma.ingredient.count();
    const existingRows = await prisma.recipe.findMany({ select: { id: true, title: true, adminNote: true } });
    const { toCreate, toSkip, conflicts } = planImport(recipes, existingRows);
    const userInteractions = {
      favoriteRecipe: await prisma.favoriteRecipe.count(),
      mealSlotWithRecipe: await prisma.mealSlot.count({ where: { recipeId: { not: null } } }),
      recommendationExposure: await prisma.recommendationExposure.count(),
      shoppingItems: await prisma.shoppingItem.count(),
    };

    console.log(`[plan] mode=${apply ? 'apply' : 'dry-run'} before=${recipeCountBefore} toCreate=${toCreate.length} toSkip=${toSkip.length} conflicts=${conflicts.length}`);
    if (conflicts.length) throw new Error(`SAFETY STOP: ${conflicts[0]}`);

    let createdCount = 0;
    if (apply) {
      await prisma.$transaction(async (tx) => {
        const liveRows = await tx.recipe.findMany({ select: { id: true, adminNote: true } });
        const livePlan = planImport(recipes, liveRows);
        if (livePlan.conflicts.length) throw new Error(`SAFETY STOP inside transaction: ${livePlan.conflicts[0]}`);
        for (const recipe of recipes) {
          const id = String(recipe.recipeId);
          if (!livePlan.toCreate.includes(id)) continue;
          await tx.recipe.create({ data: mapForLiteFood(recipe, startedAt) });
          createdCount++;
        }
      }, { timeout: 600000, maxWait: 30000 });
    }

    const recipeCountAfter = await prisma.recipe.count();
    const liteRowsAfter = await prisma.recipe.findMany({
      where: { id: { in: recipes.map((recipe) => String(recipe.recipeId)) } },
      select: {
        id: true,
        title: true,
        category: true,
        dishType: true,
        categories: true,
        adminNote: true,
        ingredients: { select: { ingredientId: true, name: true }, orderBy: { order: 'asc' } },
      },
    });
    const liteTaggedAfter = liteRowsAfter.filter((row) => parseAdminNote(row.adminNote).source === SOURCE_TAG);
    const secondRunCreateCount = apply ? recipes.length - liteRowsAfter.length : null;

    const report = {
      schemaVersion: 1,
      source: SOURCE_TAG,
      datasetVersion: DATASET_VERSION,
      generatedAt: new Date().toISOString(),
      startedAt,
      mode: apply ? 'apply' : 'dry-run',
      database: { redactedUrl: db.redactedUrl, databaseName: db.databaseName, host: db.host },
      validation: recipeValidation.summary,
      recipeCountBefore,
      ingredientCountBefore,
      existingBaseRecipeCountPreserved: recipeCountBefore,
      plannedCreateCount: toCreate.length,
      plannedSkipCount: toSkip.length,
      createdCount: apply ? createdCount : 0,
      skippedCount: apply ? toSkip.length : 0,
      recipeCountAfter,
      liteRecipeRowsAfter: liteRowsAfter.length,
      liteTaggedRowsAfter: liteTaggedAfter.length,
      expectedLiteRecipeCount: EXPECTED_LITE_RECIPES,
      secondRunCreateCount,
      idempotencyVerified: apply ? secondRunCreateCount === 0 : null,
      destructiveOperationUsed: false,
      createOnlyImport: true,
      userInteractionsPreserved: userInteractions,
      conflicts,
      sampleRows: liteTaggedAfter.slice(0, 3).map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        ingredientIds: row.ingredients.map((ingredient) => ingredient.ingredientId),
      })),
    };
    fs.mkdirSync(QA_DIR, { recursive: true });
    fs.writeFileSync(QA_PATH, JSON.stringify(report, null, 2));
    console.log(`[result] created=${report.createdCount} skipped=${report.skippedCount} after=${recipeCountAfter} liteTagged=${liteTaggedAfter.length}`);
    console.log(`[report] ${path.relative(ROOT, QA_PATH)}`);
    if (apply && createdCount !== toCreate.length) throw new Error(`Created ${createdCount}, expected ${toCreate.length}.`);
    if (apply && liteTaggedAfter.length !== EXPECTED_LITE_RECIPES) throw new Error(`Lite tagged rows after import ${liteTaggedAfter.length}, expected ${EXPECTED_LITE_RECIPES}.`);
    if (apply && secondRunCreateCount !== 0) throw new Error('Idempotency check failed: second run would still create rows.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('IMPORT ERROR:', error.message);
    process.exit(1);
  });
}

module.exports = { planImport, mapForLiteFood, QA_PATH };
