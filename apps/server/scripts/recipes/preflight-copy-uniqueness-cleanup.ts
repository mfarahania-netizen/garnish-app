import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const COPY_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const AUDIT_JSON = path.join(COPY_DIR, 'full_recipe_copy_quality_audit_after_meze50.json');
const PREFLIGHT_MD = path.join(COPY_DIR, 'uniqueness_cleanup_preflight.md');
const ROLLBACK_JSON = path.join(COPY_DIR, 'uniqueness_cleanup_rollback.json');

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(url);
  const looksProd = /prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!isLocal || looksProd) throw new Error('DATABASE_URL is not local/dev');
  return url.replace(/:[^:@/]+@/, ':***@');
}

async function main() {
  const database = localDbGuard();
  const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
  if ((audit.critical || 0) > 0) throw new Error('Hard stop: CRITICAL copy findings exist before uniqueness cleanup');
  const prisma = new PrismaClient();
  try {
    const [recipeCount, ingredientCount, mezeCount, mezePublic, mezeNonDraft, recipes] = await Promise.all([
      prisma.recipe.count(),
      prisma.ingredient.count(),
      prisma.recipe.count({ where: { id: { startsWith: 'meze50_' } } }),
      prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, isPublic: true } }),
      prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, NOT: { status: 'draft' } } }),
      prisma.recipe.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          tips: true,
          faq: true,
          chefTips: true,
          commonMistakes: true,
          servingSuggestions: true,
          substitutions: true,
          gris: true,
        },
      }),
    ]);
    fs.writeFileSync(ROLLBACK_JSON, `${JSON.stringify({ generatedAt: new Date().toISOString(), recipes }, null, 2)}\n`, 'utf8');
    const ok = recipeCount === 639 && ingredientCount === 1084 && mezeCount === 50 && mezePublic === 0 && mezeNonDraft === 0 && (audit.critical || 0) === 0;
    fs.writeFileSync(PREFLIGHT_MD, [
      '# Copy Uniqueness Cleanup Preflight',
      '',
      `- generatedAt: ${new Date().toISOString()}`,
      `- database: ${database}`,
      `- recipe count: ${recipeCount}`,
      `- ingredient count: ${ingredientCount}`,
      `- Meze count: ${mezeCount}`,
      `- Meze public rows: ${mezePublic}`,
      `- Meze non-draft rows: ${mezeNonDraft}`,
      `- CRITICAL copy findings: ${audit.critical || 0}`,
      `- HIGH repeated findings before cleanup: ${audit.high || 0}`,
      `- MEDIUM repeated findings before cleanup: ${audit.medium || 0}`,
      `- rollback snapshot: ${ROLLBACK_JSON}`,
      `- verdict: ${ok ? 'PASS' : 'FAIL'}`,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok, recipeCount, ingredientCount, mezeCount, mezePublic, mezeNonDraft, critical: audit.critical || 0 }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
