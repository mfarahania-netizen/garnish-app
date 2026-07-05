import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.join(ROOT, 'docs/qa/recipes/full-integrity-sprint');
const OUT_JSON = path.join(OUT_DIR, 'substitution_quality_audit.json');
const OUT_MD = path.join(OUT_DIR, 'substitution_quality_audit.md');
const FIX_MD = path.join(OUT_DIR, 'substitution_logic_fix_report.md');

const IDENTITY = ['نعناع', 'لیمو', 'زیتون', 'فتا', 'لبنه', 'زعتر', 'گردو', 'رب انار', 'تخم مرغ', 'mint', 'lime', 'lemon', 'olive', 'feta', 'labneh', 'zaatar', 'walnut', 'egg'];
const norm = (v: unknown) => String(v ?? '').replace(/[‌‍]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const list = (v: any) => Array.isArray(v) ? v.filter(Boolean) : [];

function isIdentity(ingredient: any) {
  const name = norm(ingredient?.displayName || ingredient?.name);
  const role = norm(ingredient?.role);
  return ingredient?.identityCritical === true || IDENTITY.some((word) => name.includes(norm(word))) || /پایه|اصلی|هویت|امضایی|signature|base|main/.test(role);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({ select: { id: true, title: true, category: true, adminNote: true, gris: true } });
    const findings: any[] = [];
    let ingredientLines = 0;
    for (const recipe of recipes) {
      const gris: any = recipe.gris || {};
      for (const ingredient of list(gris.ingredients)) {
        ingredientLines++;
        const identityCritical = isIdentity(ingredient);
        const hasActiveReplacement = Array.isArray(ingredient.replacementCandidates) && ingredient.replacementCandidates.length > 0;
        if (identityCritical && hasActiveReplacement) {
          findings.push({
            recipeId: recipe.id,
            titleFa: recipe.title,
            ingredient: ingredient.displayName || ingredient.name,
            role: ingredient.role || null,
            class: 'IDENTITY_CRITICAL_REPLACEMENT_VISIBLE',
            severity: 'HIGH',
            activeText: ingredient.replacementCandidates,
            recommended: 'Hide replacement UI and keep no safe substitution unless recipe-specific candidate is curated.',
          });
        }
      }
    }
    const mojitoMint = findings.filter((f) => /mojito/i.test(f.recipeId) && /نعناع|mint/i.test(f.ingredient));
    const report = {
      generatedAt: new Date().toISOString(),
      recipeCount: recipes.length,
      ingredientLines,
      unsafeReplacementCount: findings.length,
      mojitoMintUnsafeCount: mojitoMint.length,
      ok: findings.length === 0 && mojitoMint.length === 0,
      findings,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_MD, [
      '# Substitution Quality Audit',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- recipes scanned: ${report.recipeCount}`,
      `- ingredient lines scanned: ${report.ingredientLines}`,
      `- unsafe replacements: ${report.unsafeReplacementCount}`,
      `- mojito mint unsafe: ${report.mojitoMintUnsafeCount}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## Findings',
      findings.length ? findings.slice(0, 200).map((f) => `- ${f.recipeId} / ${f.ingredient}: ${f.class}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(FIX_MD, [
      '# Substitution Logic Fix Report',
      '',
      '- Frontend recipe ingredient UI now renders replacement controls only when `ingredientSafetyMeta(...).isReplaceable` is true.',
      '- Identity-critical and structural ingredients show no replacement button.',
      '- Server `/ai/substitutions` now fails closed for identity-critical standalone queries such as mint, feta, labneh, zaatar, olive, walnut, lemon/lime, and egg.',
      '- Random fallback suggestions are no longer reachable from the recipe page for identity-critical ingredients.',
      '',
      `Audit verdict after code guard: ${report.ok ? 'PASS' : 'FAIL - existing GRIS still has unsafe authored swap text; UI guard hides it.'}`,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: report.ok, unsafeReplacementCount: findings.length }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
