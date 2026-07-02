import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  APPLY_DIR,
  APPLY_REPORT_JSON,
  APPLY_REPORT_MD,
  ROLLBACK_JSON,
  STAGING_JSON,
  localDbGuard,
  parseJson,
  readJson,
  validateParsedRecipes,
  writeJson,
} from './gris-repair-common';

function asArray(value: any) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function enrichIngredients(parsedIngredients: any[], currentIngredients: any[]) {
  return parsedIngredients.map((ingredient, index) => {
    const current = currentIngredients[index] || null;
    return {
      ...ingredient,
      ingredientId: current?.ingredientId || null,
      code: current?.ingredient?.code || null,
      weightG: current?.unit === 'g' && Number.isFinite(Number(current?.amount)) ? Number(current.amount) : null,
      volume: ingredient.volume || [current?.amount, current?.unit].filter(Boolean).join(' ') || null,
      amount: current?.amount ?? null,
      unit: current?.unit ?? null,
      displayUnit: current?.unit ?? null,
      optional: false,
    };
  });
}

function mergeGris(existing: any, patch: any, currentRecipe: any) {
  const currentIngredients = asArray(currentRecipe.ingredients);
  return {
    ...(existing || {}),
    ...patch,
    schemaVersion: 'gris_repair_001_110_v1',
    recipeId: currentRecipe.id,
    title: currentRecipe.title,
    story: {
      ...(existing?.story || {}),
      ...(patch.story || {}),
    },
    glance: {
      ...(existing?.glance || {}),
      ...(patch.glance || {}),
      servings: existing?.glance?.servings ?? currentRecipe.servings ?? null,
      totalTimeMin: existing?.glance?.totalTimeMin ?? currentRecipe.cookingTime ?? null,
      activeTimeMin: existing?.glance?.activeTimeMin ?? currentRecipe.cookingTime ?? null,
      difficulty: existing?.glance?.difficulty ?? currentRecipe.difficulty ?? null,
    },
    ingredients: enrichIngredients(asArray(patch.ingredients), currentIngredients),
    steps: asArray(patch.steps),
    finish: {
      ...(existing?.finish || {}),
      ...(patch.finish || {}),
    },
    keep: {
      ...(existing?.keep || {}),
      ...(patch.keep || {}),
    },
    nourishment: {
      ...(existing?.nourishment || {}),
      ...(patch.nourishment || {}),
      medicalClaimsAllowed: false,
      strictDietPlanningAllowed: false,
    },
    dietary: {
      ...(existing?.dietary || {}),
      containsPork: currentRecipe.containsPork === true,
      allergens: parseJson(currentRecipe.allergens, []),
    },
  };
}

function removeLoneSurrogates(value: string) {
  return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function sanitizeJson(value: any): any {
  if (typeof value === 'string') return removeLoneSurrogates(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeJson(item)]));
  }
  return value;
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

function safeReportMd(report: any) {
  const ids = report.recipeIdsToUpdate.map((id: string, i: number) => `| ${i + 1} | \`${id}\` |`).join('\n');
  return [
    '# GRIS Repair 001-110 Apply Report',
    '',
    `- mode: ${report.mode}`,
    `- generatedAt: ${report.generatedAt}`,
    `- database: ${report.db.redacted}`,
    `- count before: ${report.recipeCountBefore}`,
    `- count after: ${report.recipeCountAfter}`,
    `- updated recipe count: ${report.updatedRecipeCount}`,
    `- created recipe count: ${report.createdRecipeCount}`,
    `- deleted recipe count: ${report.deletedRecipeCount}`,
    `- validation: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- zero creates: ${report.createdRecipeCount === 0}`,
    `- zero deletes: ${report.deletedRecipeCount === 0}`,
    '',
    '## Modified Field Mapping',
    '',
    '- `Recipe.gris.story` ← markdown داستان',
    '- `Recipe.gris.glance.promise` and `Recipe.gris.firstLook` ← markdown نگاه اول',
    '- `Recipe.gris.ingredients` ← markdown مواد لازم enriched with existing DB ingredient identity by order',
    '- `Recipe.gris.whyItWorks` ← markdown علم آشپزی',
    '- `Recipe.gris.skillsLearned` ← markdown چی یاد می‌گیری',
    '- `Recipe.gris.steps` ← markdown مراحل پخت',
    '- `Recipe.gris.finish` ← markdown پایان و راز سرآشپز',
    '- `Recipe.gris.troubleshooting` ← markdown رفع مشکل',
    '- `Recipe.gris.variations` ← markdown تغییرات',
    '- `Recipe.gris.keep` ← markdown نگه‌داری و گرم‌کردن',
    '- `Recipe.gris.serveWith` ← markdown سرو با',
    '- `Recipe.gris.faq` ← markdown سؤال‌های پرتکرار',
    '- `Recipe.gris.nourishment` ← markdown ارزش غذایی',
    '',
    'Untouched: RecipeIngredient rows, RecipeStep rows, Nutrition numeric rows, media, slug/admin identity, searchTerms, status/visibility, category/tags/mealTypes.',
    '',
    '## Recipe IDs',
    '',
    '| # | recipeId |',
    '|---|---|',
    ids,
    '',
    '## Errors',
    '',
    report.errors.length ? report.errors.map((e: string) => `- ${e}`).join('\n') : '- none',
    '',
  ].join('\n');
}

function safeReportMdV2(report: any) {
  const ids = report.recipeIdsToUpdate.map((id: string, i: number) => `| ${i + 1} | \`${id}\` |`).join('\n');
  return [
    '# GRIS Repair 001-110 Apply Report',
    '',
    `- mode: ${report.mode}`,
    `- generatedAt: ${report.generatedAt}`,
    `- database: ${report.db.redacted}`,
    `- count before: ${report.recipeCountBefore}`,
    `- count after: ${report.recipeCountAfter}`,
    `- planned update count: ${report.plannedUpdateCount}`,
    `- updated recipe count: ${report.updatedRecipeCount}`,
    `- created recipe count: ${report.createdRecipeCount}`,
    `- deleted recipe count: ${report.deletedRecipeCount}`,
    `- validation: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- duplicate recipeIds: ${report.duplicateRecipeIds.length}`,
    `- duplicate slugs: ${report.duplicateSlugs.length}`,
    `- protected/review/lite check: ${report.protectedReviewLiteCheck}`,
    '',
    '## Reproducibility Inputs',
    '',
    '- Batch markdown files under `docs/qa/recipes/gris-repair-batches/non-drinks/*.md`.',
    '- Staging JSON at `docs/qa/recipes/gris-repair-batches/non-drinks/staging/gris_repair_001_110.staging.json`.',
    '- Existing Recipe rows in the guarded local/dev DB.',
    '- No external audit/import package is required.',
    '',
    '## Modified Field Mapping',
    '',
    '- `Recipe.gris.story` from staging JSON parsed from batch markdown.',
    '- `Recipe.gris.glance` and `Recipe.gris.firstLook` from staging JSON.',
    '- `Recipe.gris.ingredients` from staging JSON, enriched with current DB RecipeIngredient identity by order.',
    '- `Recipe.gris.whyItWorks`, `skillsLearned`, `steps`, `finish`, `troubleshooting`, `variations`, `keep`, `serveWith`, `faq`, and `nourishment` from staging JSON.',
    '- `Recipe.gris.dietary.containsPork` and allergens preserved from the current DB Recipe row.',
    '',
    'Untouched: RecipeIngredient rows, RecipeStep rows, Nutrition numeric rows, media, slug/admin identity, searchTerms, status/visibility, category/tags/mealTypes.',
    '',
    '## Recipe IDs',
    '',
    '| # | recipeId |',
    '|---|---|',
    ids,
    '',
    '## Errors',
    '',
    report.errors.length ? report.errors.map((e: string) => `- ${e}`).join('\n') : '- none',
    '',
  ].join('\n');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = localDbGuard();
  const prisma = new PrismaClient();
  try {
    if (!fs.existsSync(STAGING_JSON)) {
      throw new Error(`Missing staging JSON. Run parse-gris-repair-markdown-batches.ts first: ${STAGING_JSON}`);
    }
    const staging = readJson<any>(STAGING_JSON);
    const recipes = staging.recipes || [];
    const parseValidation = await validateParsedRecipes(recipes, prisma);
    const ids = recipes.map((recipe: any) => recipe.recipeId);
    const slugs = recipes.map((recipe: any) => recipe.slug);
    const recipeCountBefore = await prisma.recipe.count();
    const rows = await prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        servings: true,
        cookingTime: true,
        totalTime: true,
        difficulty: true,
        allergens: true,
        containsPork: true,
        gris: true,
        adminNote: true,
        updatedAt: true,
        ingredients: {
          orderBy: { order: 'asc' },
          select: {
            ingredientId: true,
            name: true,
            amount: true,
            unit: true,
            notes: true,
            order: true,
            ingredient: { select: { code: true, nameFa: true, nameEn: true } },
          },
        },
      },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const errors: string[] = [];
    if (!parseValidation.ok) errors.push(...parseValidation.errors);
    if (recipes.length !== 110) errors.push(`expected 110 staging recipes, got ${recipes.length}`);
    for (const id of duplicateValues(ids)) errors.push(`duplicate recipeId in staging: ${id}`);
    for (const slug of duplicateValues(slugs)) errors.push(`duplicate slug in staging: ${slug}`);
    for (const recipe of recipes) {
      if (!rowById.has(recipe.recipeId)) errors.push(`recipeId does not exist for update: ${recipe.recipeId}`);
    }
    const updates = recipes.map((recipe: any) => {
      const existing = rowById.get(recipe.recipeId);
      return {
        recipeId: recipe.recipeId,
        title: existing?.title,
        before: existing?.gris ?? null,
        after: existing ? sanitizeJson(mergeGris(existing.gris, recipe.grisPatch, existing)) : null,
      };
    });
    const rollback = {
      schemaVersion: 'gris_repair_001_110_rollback_v1',
      generatedAt: new Date().toISOString(),
      db,
      recipeCountBefore,
      recipes: rows.map((row) => ({
        recipeId: row.id,
        title: row.title,
        gris: row.gris ?? null,
        adminNote: parseJson(row.adminNote, {}),
        updatedAt: row.updatedAt,
      })),
    };
    fs.mkdirSync(APPLY_DIR, { recursive: true });
    writeJson(ROLLBACK_JSON, rollback);

    let updatedRecipeCount = 0;
    if (!errors.length && apply) {
      await prisma.$transaction(async (tx) => {
        const countInsideBefore = await tx.recipe.count();
        if (countInsideBefore !== recipeCountBefore) throw new Error(`Recipe count changed before transaction update: ${recipeCountBefore} -> ${countInsideBefore}`);
        for (const update of updates) {
          if (!update.after) throw new Error(`Missing mapped GRIS update for ${update.recipeId}`);
          await tx.recipe.update({
            where: { id: update.recipeId },
            data: { gris: update.after },
          });
          updatedRecipeCount++;
        }
        const countInsideAfter = await tx.recipe.count();
        if (countInsideAfter !== countInsideBefore) throw new Error(`Recipe count changed inside transaction: ${countInsideBefore} -> ${countInsideAfter}`);
      }, { timeout: 600000, maxWait: 30000 });
    }
    const recipeCountAfter = await prisma.recipe.count();
    if (recipeCountAfter !== recipeCountBefore) errors.push(`recipe count changed: before=${recipeCountBefore} after=${recipeCountAfter}`);
    const afterRows = await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, gris: true } });
    const exposedCount = afterRows.filter((row) => row.gris && Array.isArray((row.gris as any).whyItWorks) && Array.isArray((row.gris as any).steps)).length;
    const report = {
      schemaVersion: 'gris_repair_001_110_apply_report_v1',
      generatedAt: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      db,
      ok: errors.length === 0,
      errors,
      recipeCountBefore,
      recipeCountAfter,
      updatedRecipeCount,
      plannedUpdateCount: updates.length,
      createdRecipeCount: 0,
      deletedRecipeCount: 0,
      duplicateRecipeIds: duplicateValues(ids),
      duplicateSlugs: duplicateValues(slugs),
      zeroCreates: true,
      zeroDeletes: true,
      exposedRepairedGrisCount: apply ? exposedCount : 0,
      protectedReviewLiteCheck: 'not checked with audit files because broad audit files are intentionally not required; garnish_lite_ recipeId prefix remains blocked by parser validation',
      recipeIdsToUpdate: ids,
      modifiedFieldMapping: {
        targetColumn: 'Recipe.gris',
        untouched: ['RecipeIngredient', 'RecipeStep', 'Nutrition', 'media fields', 'adminNote slug/search identity', 'status/isPublic', 'category/tags/mealTypes'],
        reproducibilityInputs: ['staging JSON', 'batch markdown', 'local/dev DB existing Recipe rows'],
      },
      outputFiles: {
        rollbackJson: path.relative(process.cwd(), ROLLBACK_JSON),
        applyReportJson: path.relative(process.cwd(), APPLY_REPORT_JSON),
        applyReportMd: path.relative(process.cwd(), APPLY_REPORT_MD),
      },
    };
    writeJson(APPLY_REPORT_JSON, report);
    fs.writeFileSync(APPLY_REPORT_MD, safeReportMdV2(report), 'utf8');
    console.log(JSON.stringify({
      ok: report.ok,
      mode: report.mode,
      recipeCountBefore,
      recipeCountAfter,
      plannedUpdateCount: updates.length,
      updatedRecipeCount,
      createdRecipeCount: 0,
      deletedRecipeCount: 0,
      errors: errors.slice(0, 30),
      recipeIdsToUpdate: ids,
      outputFiles: report.outputFiles,
    }, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
