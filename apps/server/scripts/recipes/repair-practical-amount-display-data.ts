import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.join(ROOT, 'docs/qa/recipes/full-integrity-sprint');
const ROLLBACK = path.join(OUT_DIR, 'practical_amount_scaling_data_repair_rollback.json');
const REPORT_JSON = path.join(OUT_DIR, 'practical_amount_scaling_data_repair_report.json');
const REPORT_MD = path.join(OUT_DIR, 'practical_amount_scaling_data_repair_report.md');

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(url);
  const looksProd = /prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!isLocal || looksProd) throw new Error('DATABASE_URL is not local/dev');
}

function cleanAmountText(value: any) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/(\d+)\s*½/g, '$1 و نیم')
    .replace(/(\d+)\s*¼/g, '$1 و یک‌چهارم')
    .replace(/(\d+)\s*¾/g, '$1 و سه‌چهارم')
    .replace(/Â½/g, 'نیم')
    .replace(/Â¼/g, 'یک‌چهارم')
    .replace(/Â¾/g, 'سه‌چهارم')
    .replace(/½/g, 'نیم')
    .replace(/¼/g, 'یک‌چهارم')
    .replace(/¾/g, 'سه‌چهارم')
    .replace(/\s*·\s*/g, ' ')
    .replace(/\s*Â·\s*/g, ' ')
    .replace(/\bgrams?\b/gi, 'گرم')
    .replace(/\bg\b/gi, 'گرم')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanGris(value: any) {
  if (!value || typeof value !== 'object') return value;
  const gris = JSON.parse(JSON.stringify(value));
  if (Array.isArray(gris.ingredients)) {
    for (const ingredient of gris.ingredients) {
      ingredient.volume = cleanAmountText(ingredient.volume);
      ingredient.displayUnit = cleanAmountText(ingredient.displayUnit);
      ingredient.amount = cleanAmountText(ingredient.amount);
    }
  }
  return gris;
}

function hasBad(value: any) {
  return typeof value === 'string' && /(?:½|¼|¾|Â½|Â¼|Â¾)|[0-9۰-۹]\s*g\b|(?:·|Â·)/i.test(value);
}

async function main() {
  localDbGuard();
  const prisma = new PrismaClient();
  try {
    const beforeRecipeCount = await prisma.recipe.count();
    const beforeIngredientCount = await prisma.ingredient.count();
    const recipes = await prisma.recipe.findMany({ select: { id: true, title: true, gris: true } });
    const targets = recipes.filter((recipe) => ((recipe.gris as any)?.ingredients || []).some((ingredient: any) => hasBad(ingredient.volume) || hasBad(ingredient.displayUnit) || hasBad(ingredient.amount)));
    fs.writeFileSync(ROLLBACK, `${JSON.stringify({ generatedAt: new Date().toISOString(), recipes: targets }, null, 2)}\n`, 'utf8');
    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const recipe of targets) {
        await tx.recipe.update({ where: { id: recipe.id }, data: { gris: cleanGris(recipe.gris) } });
        updated += 1;
      }
    }, { timeout: 600000, maxWait: 30000 });
    const afterRecipeCount = await prisma.recipe.count();
    const afterIngredientCount = await prisma.ingredient.count();
    const report = {
      generatedAt: new Date().toISOString(),
      updatedRecipes: updated,
      recipeCountBefore: beforeRecipeCount,
      recipeCountAfter: afterRecipeCount,
      ingredientCountBefore: beforeIngredientCount,
      ingredientCountAfter: afterIngredientCount,
      rollback: ROLLBACK,
      ok: beforeRecipeCount === afterRecipeCount && beforeIngredientCount === afterIngredientCount,
    };
    fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(REPORT_MD, [
      '# Practical Amount Scaling Data Repair Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- updated recipes: ${updated}`,
      `- recipe count: ${beforeRecipeCount} -> ${afterRecipeCount}`,
      `- ingredient count: ${beforeIngredientCount} -> ${afterIngredientCount}`,
      '- changed scope: Recipe.gris ingredient amount display fields only',
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
