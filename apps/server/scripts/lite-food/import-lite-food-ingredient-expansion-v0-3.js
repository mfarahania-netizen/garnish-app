const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapIngredient } = require('../data/ingredient-dictionary');
const {
  QA_DIR,
  SOURCE_TAG,
  assertLocalDevDatabase,
  loadLiteFoodData,
  validateIngredientExpansion,
  EXPECTED_COMBINED_INGREDIENTS,
} = require('./lite-food-v0-3');

const QA_PATH = path.join(QA_DIR, 'lite_food_v0_3_ingredient_import_results.json');

async function main() {
  const apply = process.argv.includes('--apply');
  const startedAt = new Date().toISOString();
  const db = assertLocalDevDatabase();
  const validation = validateIngredientExpansion();
  console.log('=== LITE_FOOD v0.3 INGREDIENT IMPORT ===');
  console.log(`[db] ${db.redactedUrl} (${db.databaseName}@${db.host})`);
  console.log(`[validate] ${validation.ok ? 'PASS' : 'FAIL'} ${JSON.stringify(validation.summary)}`);
  if (!validation.ok) {
    for (const error of validation.errors) console.log(' -', error);
    throw new Error('Validation failed — STOP.');
  }

  const { expansion } = loadLiteFoodData();
  const prisma = new PrismaClient();
  try {
    const countBefore = await prisma.ingredient.count();
    const existingRows = await prisma.ingredient.findMany({
      where: {
        OR: [
          { id: { in: expansion.map((i) => String(i.ingredientId)) } },
          { code: { in: expansion.map((i) => String(i.code)) } },
        ],
      },
      select: { id: true, code: true },
    });

    const existingById = new Map(existingRows.map((i) => [i.id, i]));
    const ownerByCode = new Map(existingRows.map((i) => [i.code, i.id]));
    const conflicts = [];
    for (const ingredient of expansion) {
      const id = String(ingredient.ingredientId);
      const code = String(ingredient.code);
      if (existingById.has(id) && existingById.get(id).code !== code) {
        conflicts.push(`ingredientId ${id} exists with different code ${existingById.get(id).code}`);
      }
      if (ownerByCode.has(code) && ownerByCode.get(code) !== id) {
        conflicts.push(`code ${code} exists under different ingredientId ${ownerByCode.get(code)}`);
      }
    }

    const toCreate = expansion.filter((i) => !existingById.has(String(i.ingredientId))).map((i) => String(i.ingredientId));
    const toUpsertExisting = expansion.length - toCreate.length;
    console.log(`[plan] mode=${apply ? 'apply' : 'dry-run'} before=${countBefore} toCreate=${toCreate.length} toUpsertExisting=${toUpsertExisting} conflicts=${conflicts.length}`);
    if (conflicts.length) throw new Error(`SAFETY STOP: ${conflicts[0]}`);

    let createdCount = 0;
    let upsertedExistingCount = 0;
    if (apply) {
      await prisma.$transaction(async (tx) => {
        for (const raw of expansion) {
          const id = String(raw.ingredientId);
          const mapped = mapIngredient(raw);
          mapped.raw = { ...raw, source: SOURCE_TAG };
          await tx.ingredient.upsert({
            where: { id },
            create: mapped,
            update: {
              ...mapped,
              id: undefined,
              code: undefined,
            },
          });
          if (existingById.has(id)) upsertedExistingCount++;
          else createdCount++;
        }
      }, { timeout: 120000, maxWait: 30000 });
    }

    const countAfter = await prisma.ingredient.count();
    const expansionRowsAfter = await prisma.ingredient.count({ where: { id: { in: expansion.map((i) => String(i.ingredientId)) } } });
    const secondRunCreateCount = apply
      ? expansion.length - await prisma.ingredient.count({ where: { id: { in: expansion.map((i) => String(i.ingredientId)) } } })
      : null;

    const report = {
      schemaVersion: 1,
      source: SOURCE_TAG,
      generatedAt: new Date().toISOString(),
      startedAt,
      mode: apply ? 'apply' : 'dry-run',
      database: { redactedUrl: db.redactedUrl, databaseName: db.databaseName, host: db.host },
      validation: validation.summary,
      ingredientCountBefore: countBefore,
      plannedCreateCount: toCreate.length,
      plannedUpsertExistingCount: toUpsertExisting,
      createdCount: apply ? createdCount : 0,
      upsertedExistingCount: apply ? upsertedExistingCount : 0,
      ingredientCountAfter: countAfter,
      expansionRowsAfter,
      expectedCombinedIngredientCount: EXPECTED_COMBINED_INGREDIENTS,
      secondRunCreateCount,
      idempotencyVerified: apply ? secondRunCreateCount === 0 : null,
      destructiveOperationUsed: false,
      conflicts,
    };
    fs.mkdirSync(QA_DIR, { recursive: true });
    fs.writeFileSync(QA_PATH, JSON.stringify(report, null, 2));
    console.log(`[result] created=${report.createdCount} upsertedExisting=${report.upsertedExistingCount} after=${countAfter} expansionRows=${expansionRowsAfter}`);
    console.log(`[report] ${path.relative(path.resolve(__dirname, '../../../..'), QA_PATH)}`);
    if (apply && expansionRowsAfter !== expansion.length) throw new Error('Post-import expansion row count mismatch.');
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

module.exports = { QA_PATH };
