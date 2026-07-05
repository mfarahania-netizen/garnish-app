import fs from 'node:fs';
import path from 'node:path';
import { parseJson, prisma, recipeBlob } from './culinary-authenticity-sprint-common';

const sourceSprintDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'source-backed-authenticity-116');
const rulesPath = path.join(sourceSprintDir, 'source_backed_rules_116.json');

type AuditStatus =
  | 'AUTH_PASS_SOURCE_BACKED'
  | 'AUTH_PASS_LOW_RISK'
  | 'AUTH_METADATA_ONLY_FIX'
  | 'AUTH_CONTENT_FIX_REQUIRED'
  | 'AUTH_INGREDIENT_FIX_REQUIRED'
  | 'AUTH_VARIANT_AMBIGUOUS'
  | 'AUTH_BLOCKED_BY_DICTIONARY'
  | 'NEEDS_HUMAN_DECISION'
  | 'NEEDS_EXTERNAL_RESEARCH';

function writeJson(name: string, value: unknown) {
  fs.mkdirSync(sourceSprintDir, { recursive: true });
  fs.writeFileSync(path.join(sourceSprintDir, name), JSON.stringify(value, null, 2), 'utf8');
}

function writeCsv(name: string, rows: Record<string, unknown>[]) {
  fs.mkdirSync(sourceSprintDir, { recursive: true });
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [headers.map(cell).join(',')]
    .concat(rows.map((row) => headers.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(sourceSprintDir, name), `${body}\n`, 'utf8');
}

function writeMd(name: string, value: string) {
  fs.mkdirSync(sourceSprintDir, { recursive: true });
  fs.writeFileSync(path.join(sourceSprintDir, name), value, 'utf8');
}

function patternHit(blob: string, pattern: string) {
  return pattern
    .split('|')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .some((part) => blob.includes(part));
}

function relationAlignmentIssues(recipe: any) {
  const grisIngredients = Array.isArray(recipe.gris?.ingredients) ? recipe.gris.ingredients : [];
  const relationCodes = new Set(recipe.ingredients.map((ri: any) => ri.ingredient?.code).filter(Boolean));
  return grisIngredients
    .filter((item: any) => item?.code && !relationCodes.has(item.code))
    .map((item: any) => `GRIS code not in RecipeIngredient: ${item.code}`);
}

async function main() {
  const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8')).rules;
  if (rules.length !== 116) throw new Error(`EXPECTED_116_RULES_FOUND_${rules.length}`);
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: rules.map((r: any) => r.recipeId) } },
    include: {
      ingredients: { include: { ingredient: true }, orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const rows = rules.map((rule: any) => {
    const recipe = byId.get(rule.recipeId) as any;
    if (!recipe) {
      return { recipeId: rule.recipeId, slug: rule.slug, titleFa: rule.titleFa, status: 'NEEDS_HUMAN_DECISION' as AuditStatus, failures: ['recipe missing'] };
    }
    const blob = recipeBlob(recipe);
    const missingRequired = (rule.requiredCoreIngredients ?? []).filter((pattern: string) => !patternHit(blob, pattern));
    const forbiddenPresent = (rule.forbiddenIngredients ?? []).filter((pattern: string) => patternHit(blob, pattern));
    const suspiciousPresent = (rule.suspiciousIngredients ?? []).filter((pattern: string) => patternHit(blob, pattern));
    const alignmentIssues = relationAlignmentIssues(recipe);
    const grisSteps = Array.isArray(recipe.gris?.steps) ? recipe.gris.steps.length : 0;
    const contradictions: string[] = [];
    if (recipe.steps.length > 0 && grisSteps > 0 && Math.abs(recipe.steps.length - grisSteps) > 4) {
      contradictions.push(`RecipeStep count ${recipe.steps.length} vs GRIS steps ${grisSteps}`);
    }
    let status: AuditStatus;
    if (rule.ruleStatus === 'NEEDS_EXTERNAL_RESEARCH') status = 'NEEDS_EXTERNAL_RESEARCH';
    else if (rule.ruleStatus === 'NEEDS_HUMAN_DECISION') status = 'NEEDS_HUMAN_DECISION';
    else if (rule.ruleStatus === 'LOW_RISK_SIMPLE_RULED' || rule.ruleStatus === 'NON_COOKING_LOW_PRIORITY_RULED') status = 'AUTH_PASS_LOW_RISK';
    else if (missingRequired.length || forbiddenPresent.length || alignmentIssues.length || contradictions.length) {
      status = missingRequired.length ? 'AUTH_INGREDIENT_FIX_REQUIRED' : 'AUTH_CONTENT_FIX_REQUIRED';
    } else if (suspiciousPresent.length) {
      status = 'AUTH_VARIANT_AMBIGUOUS';
    } else {
      status = 'AUTH_PASS_SOURCE_BACKED';
    }
    return {
      recipeId: rule.recipeId,
      slug: rule.slug,
      titleFa: rule.titleFa,
      ruleStatus: rule.ruleStatus,
      status,
      missingRequired: missingRequired.join(' | '),
      forbiddenPresent: forbiddenPresent.join(' | '),
      suspiciousPresent: suspiciousPresent.join(' | '),
      alignmentIssues: alignmentIssues.join(' | '),
      contradictions: contradictions.join(' | '),
      ingredientCount: recipe.ingredients.length,
      stepCount: recipe.steps.length,
      sourceCount: rule.sourceRefs?.length ?? 0,
    };
  });
  const statusCounts = rows.reduce((acc: Record<string, number>, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  const fixCandidates = rows.filter((row) =>
    ['AUTH_METADATA_ONLY_FIX', 'AUTH_CONTENT_FIX_REQUIRED', 'AUTH_INGREDIENT_FIX_REQUIRED'].includes(row.status),
  );
  const humanQueue = rows.filter((row) =>
    ['AUTH_VARIANT_AMBIGUOUS', 'AUTH_BLOCKED_BY_DICTIONARY', 'NEEDS_HUMAN_DECISION', 'NEEDS_EXTERNAL_RESEARCH'].includes(row.status),
  );
  writeJson('audit_116_against_rules.json', { generatedAt: new Date().toISOString(), statusCounts, rows });
  writeCsv('fix_candidates_116.csv', fixCandidates.length ? fixCandidates : [{ status: 'NONE', recipeId: '', titleFa: '', reason: '' }]);
  writeCsv('human_decision_queue_116.csv', humanQueue.length ? humanQueue : [{ status: 'NONE', recipeId: '', titleFa: '', reason: '' }]);
  writeMd(
    'audit_116_against_rules.md',
    `# Audit 116 Against Source-Backed Rules

- generatedAt: ${new Date().toISOString()}

## Status Counts

${Object.entries(statusCounts).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Fix Candidates

| Status | Title | Slug | Missing Required | Forbidden Present | Alignment |
|---|---|---|---|---|---|
${fixCandidates
  .map(
    (row) =>
      `| ${row.status} | ${row.titleFa} | ${row.slug} | ${row.missingRequired || '-'} | ${row.forbiddenPresent || '-'} | ${row.alignmentIssues || '-'} |`,
  )
  .join('\n') || '| NONE | - | - | - | - | - |'}

## Human / External Queue

| Status | Title | Slug | Rule Status |
|---|---|---|---|
${humanQueue.map((row) => `| ${row.status} | ${row.titleFa} | ${row.slug} | ${row.ruleStatus} |`).join('\n') || '| NONE | - | - | - |'}
`,
  );
  console.log(JSON.stringify({ ok: true, statusCounts, fixCandidates: fixCandidates.length, humanQueue: humanQueue.length }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
