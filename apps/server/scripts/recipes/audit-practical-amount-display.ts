import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const REPORT_JSON = path.join(ROOT, 'docs/qa/recipes/full-integrity-sprint/practical_amount_scaling_test_report.json');
const REPORT_MD = path.join(ROOT, 'docs/qa/recipes/full-integrity-sprint/practical_amount_scaling_test_report.md');

async function main() {
  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        gris: true,
      },
    });
    const bad: any[] = [];
    const rawBadRe = /(?:½|¼|¾|Â½|Â¼|Â¾)|[0-9۰-۹]\s*g\b|(?:·|Â·)/i;
    for (const recipe of recipes) {
      for (const ingredient of ((recipe.gris as any)?.ingredients || [])) {
        for (const key of ['volume', 'displayUnit', 'amount']) {
          const value = ingredient?.[key];
          if (typeof value === 'string' && rawBadRe.test(value)) bad.push({ recipeId: recipe.id, title: recipe.title, key, value });
        }
      }
    }
    const counts = {
      recipeCount: await prisma.recipe.count(),
      ingredientCount: await prisma.ingredient.count(),
      meze: await prisma.recipe.count({ where: { id: { startsWith: 'meze50_' } } }),
      mezePublic: await prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, isPublic: true } }),
      mezeNonDraft: await prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, NOT: { status: 'draft' } } }),
    };
    const report = { generatedAt: new Date().toISOString(), counts, badAmountCount: bad.length, badAmountSamples: bad.slice(0, 50), ok: bad.length === 0 };
    fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(REPORT_MD, [
      '# Practical Amount Scaling Test Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- recipe count: ${counts.recipeCount}`,
      `- ingredient count: ${counts.ingredientCount}`,
      `- Meze count: ${counts.meze}`,
      `- bad amount count: ${report.badAmountCount}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## Bad Samples',
      bad.length ? bad.slice(0, 50).map((item) => `- ${item.recipeId} ${item.key}: ${item.value}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: report.ok, counts, badAmountCount: bad.length }, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
