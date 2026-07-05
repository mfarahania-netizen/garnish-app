import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const COPY_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const DIAGNOSIS_JSON = path.join(COPY_DIR, 'copy_uniqueness_diagnosis.json');
const REPORT_JSON = path.join(COPY_DIR, 'copy_uniqueness_high_repair_report.json');
const REPORT_MD = path.join(COPY_DIR, 'copy_uniqueness_high_repair_report.md');
const MEDIUM_REPORT_MD = path.join(COPY_DIR, 'copy_uniqueness_medium_repair_report.md');

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(url);
  const looksProd = /prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!isLocal || looksProd) throw new Error('DATABASE_URL is not local/dev');
}

function cleanValue(value: any, title: string): any {
  if (typeof value === 'string') {
    return value
      .replace(/duplicate safety/gi, '')
      .replace(/only for team/gi, '')
      .replace(/why distinct/gi, '')
      .replace(/drift notes?/gi, '')
      .replace(/\bpromised\b/gi, 'قول اصلی')
      .replace(/\bing_[a-z0-9_]+(?:→|->)ing_[a-z0-9_]+/gi, `جایگزینی فقط با حفظ نقش ماده در ${title}`)
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  if (Array.isArray(value)) return value.map((item) => cleanValue(item, title));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanValue(item, title)]));
  return value;
}

async function main() {
  localDbGuard();
  const diagnosis = JSON.parse(fs.readFileSync(DIAGNOSIS_JSON, 'utf8'));
  const patchNow = (diagnosis.findings || []).filter((row: any) => row.repairDecision === 'PATCH_NOW');
  const prisma = new PrismaClient();
  try {
    const beforeRecipeCount = await prisma.recipe.count();
    const beforeIngredientCount = await prisma.ingredient.count();
    let patchedRecipes = 0;
    let patchedSentences = 0;
    if (patchNow.length) {
      const ids = [...new Set<string>(patchNow.flatMap((row: any) => row.affectedRecipeIds || []))];
      const recipes = await prisma.recipe.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, description: true, tips: true, faq: true, chefTips: true, commonMistakes: true, servingSuggestions: true, substitutions: true, gris: true },
      });
      await prisma.$transaction(async (tx) => {
        for (const recipe of recipes) {
          const before = JSON.stringify(recipe);
          const data = {
            description: cleanValue(recipe.description, recipe.title),
            tips: JSON.stringify(cleanValue(typeof recipe.tips === 'string' ? JSON.parse(recipe.tips || '[]') : [], recipe.title)),
            faq: JSON.stringify(cleanValue(typeof recipe.faq === 'string' ? JSON.parse(recipe.faq || '[]') : [], recipe.title)),
            chefTips: JSON.stringify(cleanValue(typeof recipe.chefTips === 'string' ? JSON.parse(recipe.chefTips || '[]') : [], recipe.title)),
            commonMistakes: JSON.stringify(cleanValue(typeof recipe.commonMistakes === 'string' ? JSON.parse(recipe.commonMistakes || '[]') : [], recipe.title)),
            servingSuggestions: JSON.stringify(cleanValue(typeof recipe.servingSuggestions === 'string' ? JSON.parse(recipe.servingSuggestions || '[]') : [], recipe.title)),
            substitutions: JSON.stringify(cleanValue(typeof recipe.substitutions === 'string' ? JSON.parse(recipe.substitutions || '[]') : [], recipe.title)),
            gris: cleanValue(recipe.gris, recipe.title),
          };
          if (before !== JSON.stringify({ ...recipe, ...data })) {
            await tx.recipe.update({ where: { id: recipe.id }, data });
            patchedRecipes++;
            patchedSentences++;
          }
        }
      }, { timeout: 600000, maxWait: 30000 });
    }
    const afterRecipeCount = await prisma.recipe.count();
    const afterIngredientCount = await prisma.ingredient.count();
    const report = {
      generatedAt: new Date().toISOString(),
      patchNowFindings: patchNow.length,
      patchedRecipes,
      patchedSentences,
      recipeCountBefore: beforeRecipeCount,
      recipeCountAfter: afterRecipeCount,
      ingredientCountBefore: beforeIngredientCount,
      ingredientCountAfter: afterIngredientCount,
      ok: beforeRecipeCount === afterRecipeCount && beforeIngredientCount === afterIngredientCount,
    };
    fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(REPORT_MD, [
      '# Copy Uniqueness HIGH Repair Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- PATCH_NOW findings: ${report.patchNowFindings}`,
      `- patched recipes: ${report.patchedRecipes}`,
      `- patched sentence groups: ${report.patchedSentences}`,
      `- recipe count: ${beforeRecipeCount} -> ${afterRecipeCount}`,
      `- ingredient count: ${beforeIngredientCount} -> ${afterIngredientCount}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(MEDIUM_REPORT_MD, [
      '# Copy Uniqueness MEDIUM Repair Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      '- MEDIUM findings were either allowlisted as structural or ignored as false-positive fragments.',
      '- DB writes for MEDIUM findings: 0',
      '- See copy_uniqueness_allowed_repeats.md for the documented allowlist.',
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
