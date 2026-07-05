import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.join(ROOT, 'docs/qa/recipes/full-integrity-sprint');
const OUT_JSON = path.join(OUT_DIR, 'ingredient_removability_audit.json');
const OUT_MD = path.join(OUT_DIR, 'ingredient_removability_audit.md');
const FIX_MD = path.join(OUT_DIR, 'ingredient_removability_fix_report.md');

const IDENTITY = ['نعناع', 'لیمو', 'زیتون', 'فتا', 'لبنه', 'زعتر', 'گردو', 'رب انار', 'تخم مرغ', 'mint', 'lime', 'lemon', 'olive', 'feta', 'labneh', 'zaatar', 'walnut', 'egg'];
const STRUCTURAL = ['آرد', 'خمیر', 'تخم مرغ', 'ژلاتین', 'نشاسته', 'flour', 'dough', 'egg', 'gelatin', 'starch'];
const OPTIONAL = ['اختیاری', 'تزئین', 'گارنیش', 'روی', 'پاشیدن', 'optional', 'garnish', 'topping'];
const norm = (v: unknown) => String(v ?? '').replace(/[‌‍]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const list = (v: any) => Array.isArray(v) ? v.filter(Boolean) : [];

function meta(ingredient: any) {
  const name = norm(ingredient?.displayName || ingredient?.name);
  const role = norm(ingredient?.role);
  const optional = ingredient?.optional === true || OPTIONAL.some((word) => role.includes(norm(word)));
  const identity = ingredient?.identityCritical === true || IDENTITY.some((word) => name.includes(norm(word))) || /پایه|اصلی|هویت|امضایی|signature|base|main/.test(role);
  const structural = STRUCTURAL.some((word) => name.includes(norm(word)) || role.includes(norm(word)));
  return {
    isEssential: !optional || identity || structural,
    canRemove: optional && !identity && !structural && ingredient?.canRemove !== false,
    identity,
    structural,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({ select: { id: true, title: true, gris: true } });
    const findings: any[] = [];
    let ingredientLines = 0;
    let missingCanRemove = 0;
    for (const recipe of recipes) {
      const gris: any = recipe.gris || {};
      for (const ingredient of list(gris.ingredients)) {
        ingredientLines++;
        const m = meta(ingredient);
        if (ingredient.canRemove == null && recipe.id.startsWith('meze50_')) missingCanRemove++;
        if (m.isEssential && ingredient.canRemove === true) {
          findings.push({
            recipeId: recipe.id,
            titleFa: recipe.title,
            ingredient: ingredient.displayName || ingredient.name,
            role: ingredient.role || null,
            class: 'ESSENTIAL_MARKED_REMOVABLE',
            severity: 'HIGH',
            recommended: 'Set canRemove=false and hide/disable trash icon.',
          });
        }
      }
    }
    const mojitoMint = findings.filter((f) => /mojito/i.test(f.recipeId) && /نعناع|mint/i.test(f.ingredient));
    const report = {
      generatedAt: new Date().toISOString(),
      recipeCount: recipes.length,
      ingredientLines,
      essentialRemovableCount: findings.length,
      mojitoMintRemovableCount: mojitoMint.length,
      missingCanRemove,
      ok: findings.length === 0 && mojitoMint.length === 0,
      findings,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_MD, [
      '# Ingredient Removability Audit',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- recipes scanned: ${report.recipeCount}`,
      `- ingredient lines scanned: ${report.ingredientLines}`,
      `- essential marked removable: ${report.essentialRemovableCount}`,
      `- mojito mint removable: ${report.mojitoMintRemovableCount}`,
      `- missing canRemove on Meze rows: ${report.missingCanRemove}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## Findings',
      findings.length ? findings.slice(0, 200).map((f) => `- ${f.recipeId} / ${f.ingredient}: ${f.class}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(FIX_MD, [
      '# Ingredient Removability Fix Report',
      '',
      '- Frontend recipe ingredient UI now renders trash/remove only when `ingredientSafetyMeta(...).canRemove` is true.',
      '- Identity-critical and structural ingredients do not get a trash icon.',
      '- Restore icon remains available for ingredients already removed in the current session.',
      '- Meze import staging includes `identityCritical` and `canRemove` metadata per ingredient line.',
      '',
      `Audit verdict after code guard: ${report.ok ? 'PASS' : 'FAIL - DB metadata still marks essential ingredients removable.'}`,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: report.ok, essentialRemovableCount: findings.length, missingCanRemove }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
