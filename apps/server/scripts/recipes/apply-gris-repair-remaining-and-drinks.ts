import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ROOT, asArray, parseJson, readJson, writeJson, localDbGuard } from './gris-repair-common';

const BASE_DIR = path.join(ROOT, 'docs/qa/recipes/gris-repair-batches');
const STAGING_JSON = path.join(BASE_DIR, 'staging/gris_repair_remaining_non_drinks_111_340_and_drinks_001_027.staging.json');
const APPLY_DIR = path.join(BASE_DIR, 'apply');
const DRY_JSON = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.dry_run_report.json');
const DRY_MD = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.dry_run_report.md');
const ROLLBACK_JSON = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.rollback.json');
const APPLY_JSON = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.apply_report.json');
const APPLY_MD = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.apply_report.md');
const POST_MD = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.post_apply_verification.md');
const UI_MD = path.join(APPLY_DIR, 'gris_repair_remaining_and_drinks.ui_smoke_report.md');
const PREVIOUS_REPORT = path.join(BASE_DIR, 'non-drinks/apply/gris_repair_001_110.apply_report.json');

function removeLoneSurrogates(value: string) {
  return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function sanitizeJson(value: any): any {
  if (typeof value === 'string') return removeLoneSurrogates(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeJson(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeJson(item)]));
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
  return sanitizeJson({
    ...(existing || {}),
    ...patch,
    schemaVersion: 'gris_repair_remaining_and_drinks_v1',
    recipeId: currentRecipe.id,
    title: currentRecipe.title,
    story: { ...(existing?.story || {}), ...(patch.story || {}) },
    glance: {
      ...(existing?.glance || {}),
      ...(patch.glance || {}),
      servings: existing?.glance?.servings ?? currentRecipe.servings ?? null,
      totalTimeMin: existing?.glance?.totalTimeMin ?? currentRecipe.cookingTime ?? null,
      activeTimeMin: existing?.glance?.activeTimeMin ?? currentRecipe.cookingTime ?? null,
      difficulty: existing?.glance?.difficulty ?? currentRecipe.difficulty ?? null,
    },
    ingredients: enrichIngredients(asArray(patch.ingredients), asArray(currentRecipe.ingredients)),
    steps: asArray(patch.steps),
    finish: { ...(existing?.finish || {}), ...(patch.finish || {}) },
    keep: { ...(existing?.keep || {}), ...(patch.keep || {}) },
    nourishment: { ...(existing?.nourishment || {}), ...(patch.nourishment || {}), medicalClaimsAllowed: false, strictDietPlanningAllowed: false },
    dietary: { ...(existing?.dietary || {}), containsPork: currentRecipe.containsPork === true, allergens: parseJson(currentRecipe.allergens, []) },
  });
}

function hasCompleteGris(gris: any) {
  return !!(
    gris &&
    gris.story &&
    gris.glance &&
    asArray(gris.ingredients).length &&
    asArray(gris.whyItWorks).length &&
    asArray(gris.skillsLearned).length &&
    asArray(gris.steps).length &&
    gris.finish &&
    asArray(gris.troubleshooting).length &&
    asArray(gris.variations).length &&
    gris.keep &&
    asArray(gris.serveWith).length &&
    asArray(gris.faq).length &&
    gris.nourishment
  );
}

function md(report: any, title: string) {
  return [
    `# ${title}`,
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- mode: ${report.mode}`,
    `- database: ${report.db.redacted}`,
    `- recipe count before: ${report.recipeCountBefore}`,
    `- recipe count after: ${report.recipeCountAfter}`,
    `- parsed new recipes count: ${report.parsedNewRecipesCount}`,
    `- planned update count: ${report.plannedUpdateCount}`,
    `- updated count: ${report.updatedRecipeCount}`,
    `- created count: ${report.createdRecipeCount}`,
    `- deleted count: ${report.deletedRecipeCount}`,
    `- skipped previously applied 001-110 count: ${report.skippedPreviouslyApplied001110Count}`,
    `- missing DB recipeIds: ${report.missingDbRecipeIds.length}`,
    `- duplicate parsed recipeIds: ${report.duplicateParsedRecipeIds.length}`,
    `- duplicate parsed slugs: ${report.duplicateParsedSlugs.length}`,
    `- required section failures: ${report.requiredSectionFailures.length}`,
    `- internal leak failures: ${report.internalLeakFailures.length}`,
    `- forbidden generic phrase failures: ${report.forbiddenGenericPhraseFailures.length}`,
    `- validation: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    '## Errors',
    '',
    report.errors.length ? report.errors.slice(0, 300).map((e: string) => `- ${e}`).join('\n') : '- none',
    '',
  ].join('\n');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = localDbGuard();
  if (!fs.existsSync(STAGING_JSON)) throw new Error(`Missing staging JSON. Run parse-gris-repair-markdown-batches-v2.ts first: ${STAGING_JSON}`);
  const staging = readJson<any>(STAGING_JSON);
  const recipes = staging.recipes || [];
  const ids = recipes.map((recipe: any) => recipe.recipeId);
  const slugs = recipes.map((recipe: any) => recipe.slug);
  const previous = fs.existsSync(PREVIOUS_REPORT) ? readJson<any>(PREVIOUS_REPORT) : {};
  const previousIds = new Set<string>(previous.recipeIdsToUpdate || []);
  const prisma = new PrismaClient();
  try {
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
    const missingDbRecipeIds = ids.filter((id: string) => !rowById.has(id));
    const duplicateParsedRecipeIds = duplicateValues(ids);
    const duplicateParsedSlugs = duplicateValues(slugs);
    const requiredSectionFailures = staging.validation?.requiredSectionFailures || [];
    const internalLeakFailures = staging.validation?.internalLeakFailures || [];
    const forbiddenGenericPhraseFailures = staging.validation?.forbiddenGenericPhraseFailures || [];
    const previousOverlap = ids.filter((id: string) => previousIds.has(id));
    const errors = [
      ...(staging.validation?.errors || []),
      ...missingDbRecipeIds.map((id: string) => `missing DB recipeId: ${id}`),
      ...duplicateParsedRecipeIds.map((id) => `duplicate parsed recipeId: ${id}`),
      ...duplicateParsedSlugs.map((slug) => `duplicate parsed slug: ${slug}`),
      ...previousOverlap.map((id: string) => `previously applied 001-110 recipeId included: ${id}`),
    ];
    const updates = recipes.map((recipe: any) => {
      const existing = rowById.get(recipe.recipeId);
      return {
        recipeId: recipe.recipeId,
        sourceKind: recipe.sourceKind,
        title: existing?.title,
        before: existing?.gris ?? null,
        after: existing ? mergeGris(existing.gris, recipe.grisPatch, existing) : null,
      };
    });
    fs.mkdirSync(APPLY_DIR, { recursive: true });
    writeJson(ROLLBACK_JSON, {
      schemaVersion: 'gris_repair_remaining_and_drinks_rollback_v1',
      generatedAt: new Date().toISOString(),
      db,
      recipeCountBefore,
      recipes: rows.map((row) => ({ recipeId: row.id, title: row.title, gris: row.gris ?? null, adminNote: parseJson(row.adminNote, {}), updatedAt: row.updatedAt })),
    });
    let updatedRecipeCount = 0;
    if (apply && errors.length === 0) {
      await prisma.$transaction(async (tx) => {
        const insideBefore = await tx.recipe.count();
        if (insideBefore !== recipeCountBefore) throw new Error(`Recipe count changed before transaction update: ${recipeCountBefore} -> ${insideBefore}`);
        for (const update of updates) {
          if (!update.after) throw new Error(`Missing mapped update for ${update.recipeId}`);
          await tx.recipe.update({ where: { id: update.recipeId }, data: { gris: update.after } });
          updatedRecipeCount++;
        }
        const insideAfter = await tx.recipe.count();
        if (insideAfter !== insideBefore) throw new Error(`Recipe count changed inside transaction: ${insideBefore} -> ${insideAfter}`);
      }, { timeout: 600000, maxWait: 30000 });
    }
    const recipeCountAfter = await prisma.recipe.count();
    if (recipeCountAfter !== recipeCountBefore) errors.push(`recipe count changed: ${recipeCountBefore} -> ${recipeCountAfter}`);
    const afterRows = await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, gris: true } });
    const apiOkCount = afterRows.filter((row) => hasCompleteGris(row.gris)).length;
    const report = {
      schemaVersion: 'gris_repair_remaining_and_drinks_apply_report_v1',
      generatedAt: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      db,
      ok: errors.length === 0,
      errors,
      recipeCountBefore,
      recipeCountAfter,
      parsedNewRecipesCount: recipes.length,
      nonDrinkPlannedCount: recipes.filter((r: any) => r.sourceKind === 'non-drink').length,
      drinkPlannedCount: recipes.filter((r: any) => r.sourceKind === 'drink').length,
      plannedUpdateCount: updates.length,
      updatedRecipeCount,
      createdRecipeCount: 0,
      deletedRecipeCount: 0,
      skippedPreviouslyApplied001110Count: previousOverlap.length,
      missingDbRecipeIds,
      duplicateParsedRecipeIds,
      duplicateParsedSlugs,
      requiredSectionFailures,
      internalLeakFailures,
      forbiddenGenericPhraseFailures,
      apiOkCount: apply ? apiOkCount : 0,
      recipeIdsToUpdate: ids,
    };
    if (apply) {
      writeJson(APPLY_JSON, report);
      fs.writeFileSync(APPLY_MD, md(report, 'GRIS Repair Remaining + Drinks Apply Report'), 'utf8');
      fs.writeFileSync(POST_MD, md({ ...report, mode: 'post-apply-verification' }, 'GRIS Repair Remaining + Drinks Post-Apply Verification'), 'utf8');
      fs.writeFileSync(UI_MD, [
        '# GRIS Repair Remaining + Drinks UI Smoke Report',
        '',
        `- generatedAt: ${report.generatedAt}`,
        `- sampled/API-complete GRIS rows: ${apiOkCount}/${ids.length}`,
        '- frontend render path: Recipe.gris sections are consumed by the existing recipe detail renderer; full browser smoke should be run after a passing apply.',
        `- verdict: ${report.ok && apiOkCount === ids.length ? 'PASS' : 'FAIL'}`,
        '',
      ].join('\n'), 'utf8');
    } else {
      writeJson(DRY_JSON, report);
      fs.writeFileSync(DRY_MD, md(report, 'GRIS Repair Remaining + Drinks Dry-Run Report'), 'utf8');
    }
    console.log(JSON.stringify({
      ok: report.ok,
      mode: report.mode,
      recipeCountBefore,
      recipeCountAfter,
      parsedNewRecipesCount: report.parsedNewRecipesCount,
      plannedUpdateCount: report.plannedUpdateCount,
      updatedRecipeCount,
      createdRecipeCount: 0,
      deletedRecipeCount: 0,
      errors: errors.slice(0, 40),
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
