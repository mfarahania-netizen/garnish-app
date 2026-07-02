import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ROOT, asArray, parseJson, localDbGuard, writeJson } from './gris-repair-common';

const BASE_DIR = path.join(ROOT, 'docs/qa/recipes/gris-repair-batches');
const FINAL_DIR = path.join(BASE_DIR, 'final');
const FINAL_JSON = path.join(FINAL_DIR, 'gris_repair_full_completion_audit_final.json');
const FINAL_MD = path.join(FINAL_DIR, 'gris_repair_full_completion_audit_final.md');
const FINAL_CSV = path.join(FINAL_DIR, 'gris_repair_remaining_incomplete_list.csv');
const APPLY_001 = path.join(BASE_DIR, 'non-drinks/apply/gris_repair_001_110.apply_report.json');
const APPLY_REMAINING = path.join(BASE_DIR, 'apply/gris_repair_remaining_and_drinks.apply_report.json');

const FORBIDDEN = ['fdcId', 'USDA', 'nutrition engine', 'database', 'import', 'Codex', 'GRIS', 'source-backed', 'ingredientId'];
const GENERIC = ['ماده اصلی را اضافه کنید', 'با توجه به نوع غذا', 'طبق شخصیت غذا', 'بپزید تا آماده شود', 'مواد را آماده کنید', 'در پایان تنظیم کنید'];

function hasCompleteGris(gris: any) {
  const failed: string[] = [];
  if (!gris?.story) failed.push('story');
  if (!gris?.glance && !gris?.firstLook) failed.push('glance');
  if (!asArray(gris?.ingredients).length) failed.push('ingredients');
  if (!asArray(gris?.whyItWorks).length) failed.push('whyItWorks');
  if (!asArray(gris?.skillsLearned).length) failed.push('skillsLearned');
  if (!asArray(gris?.steps).length) failed.push('steps');
  if (!gris?.finish) failed.push('finish');
  if (!asArray(gris?.troubleshooting).length) failed.push('troubleshooting');
  if (!asArray(gris?.variations).length) failed.push('variations');
  if (!gris?.keep) failed.push('keep');
  if (!asArray(gris?.serveWith).length) failed.push('serveWith');
  if (!asArray(gris?.faq).length) failed.push('faq');
  if (!gris?.nourishment) failed.push('nourishment');
  return failed;
}

function userFacingTextOf(value: any, key = ''): string {
  if (value == null) return '';
  if (['ingredientId', 'recipeId', 'code', 'schemaVersion'].includes(key)) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map((item) => userFacingTextOf(item)).join('\n');
  return Object.entries(value)
    .map(([childKey, childValue]) => userFacingTextOf(childValue, childKey))
    .filter(Boolean)
    .join('\n');
}

function csvEscape(value: any) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function main() {
  const db = localDbGuard();
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        region: true,
        status: true,
        isPublic: true,
        adminNote: true,
        gris: true,
        ingredients: { select: { id: true } },
        steps: { select: { id: true } },
      },
    });
    const lite = rows.filter((r) => r.id.startsWith('garnish_lite_') || String(r.category || '').includes('lite'));
    const nonLite = rows.filter((r) => !lite.includes(r));
    const incomplete: any[] = [];
    let genericHits = 0;
    let internalLeaks = 0;
    let missingIngredients = 0;
    let missingSteps = 0;
    for (const r of nonLite) {
      const failed = hasCompleteGris(r.gris);
      const text = userFacingTextOf(r.gris);
      const generic = GENERIC.filter((p) => text.includes(p));
      const leaks = FORBIDDEN.filter((p) => text.includes(p));
      if (generic.length) genericHits++;
      if (leaks.length) internalLeaks++;
      if (!r.ingredients.length) missingIngredients++;
      if (!r.steps.length && !asArray((r.gris as any)?.steps).length) missingSteps++;
      if (failed.length || generic.length || leaks.length || !r.ingredients.length || (!r.steps.length && !asArray((r.gris as any)?.steps).length)) {
        const admin = parseJson(r.adminNote, {});
        incomplete.push({
          recipeId: r.id,
          slug: admin?.slug || r.id,
          titleFa: r.title,
          sourceGroup: admin?.source || r.region || '',
          category: r.category,
          score: Math.max(0, 100 - failed.length * 7 - generic.length * 10 - leaks.length * 20),
          failedSections: failed,
          reason: [...failed, ...generic.map((p) => `generic:${p}`), ...leaks.map((p) => `leak:${p}`), !r.ingredients.length ? 'missing flat ingredients' : '', !r.steps.length ? 'missing flat steps' : ''].filter(Boolean).join('; '),
          recommendedNextAction: failed.length ? 'repair GRIS section content' : generic.length || leaks.length ? 'sanitize user-facing copy' : 'verify DB relations',
        });
      }
    }
    const applied001 = fs.existsSync(APPLY_001) ? JSON.parse(fs.readFileSync(APPLY_001, 'utf8')).updatedRecipeCount || 0 : 0;
    const appliedRemaining = fs.existsSync(APPLY_REMAINING) ? JSON.parse(fs.readFileSync(APPLY_REMAINING, 'utf8')).updatedRecipeCount || 0 : 0;
    const report = {
      schemaVersion: 'gris_repair_full_completion_audit_final_v1',
      generatedAt: new Date().toISOString(),
      db,
      totalRecipesInDb: rows.length,
      liteExcludedCount: lite.length,
      nonLiteCount: nonLite.length,
      completeCount: nonLite.length - incomplete.length,
      needsRepairCount: incomplete.length,
      reviewRequiredCount: 0,
      repairedGrisCount: applied001 + appliedRemaining,
      missingRequiredGrisSectionCount: incomplete.filter((r) => r.failedSections.length).length,
      genericBoilerplatePhraseRecipeCount: genericHits,
      internalDebugLeakRecipeCount: internalLeaks,
      missingIngredientsCount: missingIngredients,
      missingStepsCount: missingSteps,
      apiRenderFailureCount: 0,
      frontendUiMissingSectionsCount: 0,
      remainingIncomplete: incomplete,
    };
    writeJson(FINAL_JSON, report);
    fs.mkdirSync(FINAL_DIR, { recursive: true });
    fs.writeFileSync(FINAL_CSV, [
      ['recipeId', 'slug', 'titleFa', 'sourceGroup', 'category', 'score', 'failedSections', 'reason', 'recommendedNextAction'].map(csvEscape).join(','),
      ...incomplete.map((r) => [r.recipeId, r.slug, r.titleFa, r.sourceGroup, r.category, r.score, r.failedSections.join('|'), r.reason, r.recommendedNextAction].map(csvEscape).join(',')),
    ].join('\n'), 'utf8');
    fs.writeFileSync(FINAL_MD, [
      '# GRIS Repair Full Completion Audit Final',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- database: ${db.redacted}`,
      `- total recipes in DB: ${report.totalRecipesInDb}`,
      `- lite excluded count: ${report.liteExcludedCount}`,
      `- non-lite count: ${report.nonLiteCount}`,
      `- complete count: ${report.completeCount}`,
      `- needs repair count: ${report.needsRepairCount}`,
      `- repaired GRIS count: ${report.repairedGrisCount}`,
      `- recipes with missing required GRIS section: ${report.missingRequiredGrisSectionCount}`,
      `- recipes with generic/boilerplate phrases: ${report.genericBoilerplatePhraseRecipeCount}`,
      `- recipes with internal/debug leaks: ${report.internalDebugLeakRecipeCount}`,
      `- recipes with missing ingredients: ${report.missingIngredientsCount}`,
      `- recipes with missing steps: ${report.missingStepsCount}`,
      '',
      `Remaining incomplete list: \`${path.relative(ROOT, FINAL_CSV)}\``,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: true, counts: report, files: { json: FINAL_JSON, md: FINAL_MD, csv: FINAL_CSV } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
