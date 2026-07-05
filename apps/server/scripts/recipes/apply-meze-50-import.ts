import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const IMPORT_DIR = path.join(ROOT, 'docs/qa/recipes/new-meze-50/import');
const STAGING_JSON = path.join(IMPORT_DIR, 'meze_50_staging.json');
const DRY_MD = path.join(IMPORT_DIR, 'meze_50_dry_run_report.md');
const APPLY_MD = path.join(IMPORT_DIR, 'meze_50_apply_report.md');
const ROLLBACK_JSON = path.join(IMPORT_DIR, 'meze_50_rollback.json');
const POST_MD = path.join(IMPORT_DIR, 'meze_50_post_apply_verification.md');

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const local = /localhost|127\.0\.0\.1|\[::1\]/i.test(url) && !/prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!local) throw new Error(`DATABASE_URL is not local/dev: ${url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@')}`);
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function readJson<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function dup(values: string[]) {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) out.add(value);
    seen.add(value);
  }
  return [...out];
}

function text(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function hasLeak(value: unknown) {
  return /(duplicate safety|فقط برای تیم|نه متن کاربر|ingredientId|database|Codex|import|GRIS)/i.test(text(value));
}

function mdReport(report: any, title: string) {
  return [
    `# ${title}`,
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- mode: ${report.mode}`,
    `- database: ${report.database}`,
    `- recipe count before: ${report.recipeCountBefore}`,
    `- recipe count after/simulated: ${report.recipeCountAfter}`,
    `- planned creates: ${report.plannedCreates}`,
    `- created: ${report.created}`,
    `- planned updates: ${report.plannedUpdates}`,
    `- planned deletes: ${report.plannedDeletes}`,
    `- ingredient count before: ${report.ingredientCountBefore}`,
    `- ingredient count after: ${report.ingredientCountAfter}`,
    `- duplicate id in DB: ${report.duplicateIdInDb.length}`,
    `- duplicate slug in import: ${report.duplicateSlugInImport.length}`,
    `- missing ingredient mapping: ${report.missingIngredientMapping.length}`,
    `- internal leak count: ${report.internalLeakCount}`,
    `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    '## Errors',
    report.errors.length ? report.errors.map((error: string) => `- ${error}`).join('\n') : '- none',
    '',
  ].join('\n');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = localDbGuard();
  const staging = readJson(STAGING_JSON);
  const recipes = staging.recipes || [];
  const prisma = new PrismaClient();
  try {
    const recipeCountBefore = await prisma.recipe.count();
    const ingredientCountBefore = await prisma.ingredient.count();
    const ids = recipes.map((recipe: any) => recipe.recipeId);
    const slugs = recipes.map((recipe: any) => recipe.slug);
    const existing = await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const duplicateIdInDb = existing.map((row) => row.id);
    const duplicateSlugInImport = dup(slugs);
    const duplicateIdInImport = dup(ids);
    const missingIngredientMapping = recipes.flatMap((recipe: any) =>
      (recipe.ingredients || [])
        .filter((ingredient: any) => !ingredient.ingredientId || !ingredient.code)
        .map((ingredient: any) => `${recipe.slug}: ${ingredient.name}`),
    );
    const internalLeakRows = recipes.filter((recipe: any) => hasLeak(recipe.gris));
    const errors = [
      ...(staging.ok ? [] : ['staging parse did not pass']),
      ...(recipes.length === 50 ? [] : [`expected 50 staged recipes, got ${recipes.length}`]),
      ...duplicateIdInDb.map((id: string) => `duplicate recipe id already in DB: ${id}`),
      ...duplicateIdInImport.map((id) => `duplicate recipe id in import: ${id}`),
      ...duplicateSlugInImport.map((slug) => `duplicate slug in import: ${slug}`),
      ...missingIngredientMapping.map((item) => `missing ingredient mapping: ${item}`),
      ...internalLeakRows.map((recipe: any) => `internal leak in user-facing gris: ${recipe.slug}`),
    ];
    const report: any = {
      generatedAt: new Date().toISOString(),
      mode: dryRun ? 'dry-run' : 'apply',
      database: db,
      recipeCountBefore,
      recipeCountAfter: dryRun ? recipeCountBefore + (errors.length ? 0 : 50) : null,
      ingredientCountBefore,
      ingredientCountAfter: ingredientCountBefore,
      plannedCreates: errors.length ? 0 : recipes.length,
      created: 0,
      plannedUpdates: 0,
      plannedDeletes: 0,
      duplicateIdInDb,
      duplicateSlugInImport,
      missingIngredientMapping,
      internalLeakCount: internalLeakRows.length,
      errors,
      ok: errors.length === 0,
    };
    fs.mkdirSync(IMPORT_DIR, { recursive: true });
    if (dryRun) {
      fs.writeFileSync(DRY_MD, mdReport(report, 'Meze 50 Dry Run Import Report'), 'utf8');
      console.log(JSON.stringify({ ok: report.ok, plannedCreates: report.plannedCreates, errors: report.errors.slice(0, 20) }, null, 2));
      if (!report.ok) process.exitCode = 1;
      return;
    }
    if (!report.ok) {
      fs.writeFileSync(APPLY_MD, mdReport(report, 'Meze 50 Apply Report'), 'utf8');
      console.log(JSON.stringify({ ok: false, errors: report.errors.slice(0, 20) }, null, 2));
      process.exitCode = 1;
      return;
    }
    writeJson(ROLLBACK_JSON, {
      generatedAt: report.generatedAt,
      mode: 'meze50_create_rollback',
      recipeIds: ids,
      deleteCreatedRowsToRollback: true,
      recipeCountBefore,
      ingredientCountBefore,
    });
    await prisma.$transaction(async (tx) => {
      const insideBefore = await tx.recipe.count();
      if (insideBefore !== recipeCountBefore) throw new Error(`recipe count changed before transaction: ${recipeCountBefore} -> ${insideBefore}`);
      for (const recipe of recipes) {
        await tx.recipe.create({
          data: {
            id: recipe.recipeId,
            title: recipe.titleFa,
            description: recipe.gris?.story?.origin || recipe.titleEn,
            category: recipe.category || 'پیش غذا',
            region: recipe.cuisine || null,
            difficulty: recipe.gris?.glance?.difficulty || null,
            cookingTime: recipe.gris?.glance?.handsOffMin || null,
            servings: recipe.gris?.glance?.servings || 4,
            isPublic: false,
            status: 'draft',
            prepTime: null,
            totalTime: null,
            tools: JSON.stringify(recipe.gris?.glance?.keyEquipment || []),
            tips: JSON.stringify([]),
            faq: JSON.stringify(recipe.gris?.faq || []),
            mealType: JSON.stringify(recipe.mealTypes || []),
            diet: null,
            categories: JSON.stringify([recipe.type, recipe.category].filter(Boolean)),
            allergens: JSON.stringify([]),
            occasion: JSON.stringify(['meze', 'snack', 'appetizer']),
            chefTips: JSON.stringify(recipe.gris?.finish?.chefSecret ? [recipe.gris.finish.chefSecret] : []),
            commonMistakes: JSON.stringify(recipe.gris?.troubleshooting || []),
            servingSuggestions: JSON.stringify(recipe.gris?.serveWith || []),
            substitutions: JSON.stringify([]),
            dishType: JSON.stringify([recipe.type || 'meze']),
            gris: recipe.gris,
            containsPork: false,
            adminNote: JSON.stringify({ source: 'meze-50-v1', slug: recipe.slug, rank: recipe.rank, importedAs: 'draft_hidden_qaOnly' }),
            ingredients: {
              create: (recipe.ingredients || []).map((ingredient: any, index: number) => ({
                ingredientId: ingredient.ingredientId,
                name: ingredient.name,
                amount: ingredient.amount,
                unit: ingredient.unit,
                notes: JSON.stringify({
                  line: ingredient.name,
                  displayUnit: ingredient.volume,
                  code: ingredient.code,
                  preparation: ingredient.prepState,
                  optional: ingredient.optional === true,
                  source: 'meze-50-v1',
                }),
                order: index + 1,
              })),
            },
            steps: {
              create: (recipe.gris?.steps || []).map((step: any, index: number) => ({
                title: step.title || null,
                instruction: step.instruction || String(step),
                duration: null,
                order: step.order || index + 1,
              })),
            },
          },
        });
        report.created++;
      }
      const insideAfter = await tx.recipe.count();
      if (insideAfter !== insideBefore + 50) throw new Error(`recipe count did not increase by 50 inside transaction: ${insideBefore} -> ${insideAfter}`);
      const ingredientInsideAfter = await tx.ingredient.count();
      if (ingredientInsideAfter !== ingredientCountBefore) throw new Error(`ingredient count changed: ${ingredientCountBefore} -> ${ingredientInsideAfter}`);
    }, { timeout: 600000, maxWait: 30000 });
    report.recipeCountAfter = await prisma.recipe.count();
    report.ingredientCountAfter = await prisma.ingredient.count();
    report.ok = report.recipeCountAfter === recipeCountBefore + 50 && report.created === 50 && report.ingredientCountAfter === ingredientCountBefore;
    if (!report.ok) report.errors.push('post-apply count check failed');
    fs.writeFileSync(APPLY_MD, mdReport(report, 'Meze 50 Apply Report'), 'utf8');
    const apiRows = await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, isPublic: true, status: true, ingredients: { select: { id: true } }, gris: true } });
    const post = {
      generatedAt: new Date().toISOString(),
      fetched: apiRows.length,
      expected: 50,
      ingredientRowsMissing: apiRows.filter((row) => row.ingredients.length === 0).map((row) => row.id),
      visiblePublicRows: apiRows.filter((row) => row.isPublic).map((row) => row.id),
      nonDraftRows: apiRows.filter((row) => row.status !== 'draft').map((row) => row.id),
      ok: apiRows.length === 50 && apiRows.every((row) => row.ingredients.length > 0 && !row.isPublic && row.status === 'draft'),
    };
    fs.writeFileSync(POST_MD, [
      '# Meze 50 Post Apply Verification',
      '',
      `- generatedAt: ${post.generatedAt}`,
      `- fetched: ${post.fetched}/50`,
      `- missing ingredient rows: ${post.ingredientRowsMissing.length}`,
      `- public rows: ${post.visiblePublicRows.length}`,
      `- non-draft rows: ${post.nonDraftRows.length}`,
      `- verdict: ${post.ok ? 'PASS' : 'FAIL'}`,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: report.ok && post.ok, created: report.created, recipeCountBefore, recipeCountAfter: report.recipeCountAfter }, null, 2));
    if (!(report.ok && post.ok)) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
