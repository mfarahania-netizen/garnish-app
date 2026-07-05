import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const IMPORT_DIR = path.join(ROOT, 'docs/qa/recipes/new-meze-50/import');
const STAGING_JSON = path.join(IMPORT_DIR, 'meze_50_staging.json');
const ROLLBACK = path.join(IMPORT_DIR, 'meze_50_ingredient_relation_repair_rollback.json');
const REPORT_JSON = path.join(IMPORT_DIR, 'meze_50_ingredient_relation_repair_report.json');
const REPORT_MD = path.join(IMPORT_DIR, 'meze_50_ingredient_relation_repair_report.md');

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(url);
  const looksProd = /prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!isLocal || looksProd) throw new Error('DATABASE_URL is not local/dev');
}

function ingredientNotes(ingredient: any) {
  return JSON.stringify({
    line: ingredient.name,
    displayUnit: ingredient.volume,
    code: ingredient.code,
    ingredientId: ingredient.ingredientId,
    preparation: ingredient.prepState,
    optional: ingredient.optional,
  });
}

async function main() {
  localDbGuard();
  const prisma = new PrismaClient();
  try {
    const staging = JSON.parse(fs.readFileSync(STAGING_JSON, 'utf8'));
    const recipes = staging.recipes || [];
    if (recipes.length !== 50) throw new Error(`staging recipe count ${recipes.length}, expected 50`);

    const recipeIds = recipes.map((recipe: any) => recipe.recipeId);
    const beforeCount = await prisma.recipe.count();
    const beforeIngredientCount = await prisma.ingredient.count();
    const existing = await prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: {
        id: true,
        ingredients: { orderBy: { order: 'asc' }, select: { id: true, recipeId: true, ingredientId: true, name: true, amount: true, unit: true, notes: true, order: true } },
      },
    });
    const existingById = new Map(existing.map((recipe) => [recipe.id, recipe]));
    const errors: string[] = [];
    for (const recipe of recipes) {
      const row = existingById.get(recipe.recipeId);
      if (!row) {
        errors.push(`${recipe.recipeId}: recipe missing`);
        continue;
      }
      if (row.ingredients.length > recipe.ingredients.length) {
        errors.push(`${recipe.recipeId}: ingredient row count ${row.ingredients.length}, expected ${recipe.ingredients.length}`);
      }
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.ingredientId || !ingredient.code) errors.push(`${recipe.recipeId}: unresolved ingredient ${ingredient.name}`);
      }
    }
    if (errors.length) throw new Error(errors.join('\n'));

    fs.mkdirSync(IMPORT_DIR, { recursive: true });
    fs.writeFileSync(ROLLBACK, `${JSON.stringify({ generatedAt: new Date().toISOString(), recipes: existing }, null, 2)}\n`, 'utf8');

    let updatedRows = 0;
    let createdRelationRows = 0;
    await prisma.$transaction(async (tx) => {
      for (const recipe of recipes) {
        const currentRows = existingById.get(recipe.recipeId)!.ingredients;
        for (let index = 0; index < recipe.ingredients.length; index++) {
          const target = recipe.ingredients[index];
          const current = currentRows[index];
          if (current) {
            await tx.recipeIngredient.update({
              where: { id: current.id },
              data: {
                ingredientId: target.ingredientId,
                name: target.name,
                amount: target.amount,
                unit: target.unit,
                notes: ingredientNotes(target),
                order: target.order,
              },
            });
            updatedRows += 1;
          } else {
            await tx.recipeIngredient.create({
              data: {
                recipeId: recipe.recipeId,
                ingredientId: target.ingredientId,
                name: target.name,
                amount: target.amount,
                unit: target.unit,
                notes: ingredientNotes(target),
                order: target.order,
              },
            });
            createdRelationRows += 1;
          }
        }
      }
    }, { timeout: 600000, maxWait: 30000 });

    const afterCount = await prisma.recipe.count();
    const afterIngredientCount = await prisma.ingredient.count();
    const report = {
      generatedAt: new Date().toISOString(),
      recipeCountBefore: beforeCount,
      recipeCountAfter: afterCount,
      ingredientCountBefore: beforeIngredientCount,
      ingredientCountAfter: afterIngredientCount,
      recipesChecked: recipes.length,
      relationRowsUpdated: updatedRows,
      relationRowsCreated: createdRelationRows,
      recipeCreates: 0,
      recipeDeletes: 0,
      ingredientCreates: 0,
      rollback: ROLLBACK,
      ok: beforeCount === afterCount && beforeIngredientCount === afterIngredientCount && updatedRows > 0,
    };
    fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(REPORT_MD, [
      '# Meze 50 Ingredient Relation Repair Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- recipes checked: ${report.recipesChecked}`,
      `- relation rows updated: ${report.relationRowsUpdated}`,
      `- relation rows created: ${report.relationRowsCreated}`,
      `- recipe count: ${beforeCount} -> ${afterCount}`,
      `- ingredient count: ${beforeIngredientCount} -> ${afterIngredientCount}`,
      '- Recipe created/deleted: 0/0',
      '- Ingredient created: 0',
      `- rollback: ${ROLLBACK}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
