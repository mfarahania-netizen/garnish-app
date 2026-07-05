import fs from 'node:fs';
import path from 'node:path';
import { assertLocalDatabase, getCounts, parseJson, prisma, recipeBlob, sprintDir } from './culinary-authenticity-sprint-common';

const inputDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'source-backed-authenticity-116');
const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'resolve-authenticity-85');

type ResolvedDecision =
  | 'AUTH_PASS_SOURCE_BACKED'
  | 'AUTH_PATCHED_SOURCE_BACKED'
  | 'AUTH_PASS_PRODUCT_DECISION'
  | 'HIDE_OR_UNPUBLISH_UNTIL_REVIEW'
  | 'BLOCKED_BY_DICTIONARY'
  | 'NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function writeJson(name: string, value: unknown) {
  ensureDir();
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2), 'utf8');
}

function writeMd(name: string, value: string) {
  ensureDir();
  fs.writeFileSync(path.join(outDir, name), value, 'utf8');
}

function writeCsv(name: string, rows: Record<string, unknown>[]) {
  ensureDir();
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [headers.map(cell).join(',')]
    .concat(rows.map((row) => headers.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(outDir, name), `${body}\n`, 'utf8');
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function decodeTitle(value: string) {
  if (!/[ØÙÛÚ]/.test(value)) return value;
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

function admin(recipe: any) {
  return parseJson(recipe.adminNote, {}) ?? {};
}

function slug(recipe: any) {
  return admin(recipe).slug ?? recipe.id;
}

function recipeSummary(recipe: any) {
  return {
    recipeId: recipe.id,
    slug: slug(recipe),
    titleFa: recipe.title,
    category: recipe.category,
    region: recipe.region,
    sourceGroup: admin(recipe).source ?? 'unknown',
    ingredientCount: recipe.ingredients.length,
    stepCount: recipe.steps.length,
    isPublic: recipe.isPublic,
    status: recipe.status,
  };
}

function sourceAttemptPacket(row: any, recipe: any) {
  const title = recipe?.title ?? decodeTitle(row.titleFa);
  return {
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: title,
    titleEn: row.slug.split('-').join(' '),
    country: recipe?.region === 'persian' ? 'ایران' : recipe?.region ?? 'unknown',
    regionCity: '',
    canonicalIdentity: title,
    requiredCoreIngredients: [],
    forbiddenIngredients: [],
    suspiciousIngredients: [],
    requiredTechnique: [],
    acceptableVariants: [],
    sourceRefs: [],
    confidence: 'LOW',
    decision: 'HUMAN_DECISION_REQUIRED',
    finalState: 'NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING' as ResolvedDecision,
    reason:
      'This automated pass did not establish three independent reputable culinary references. Per hard rule, no source-backed pass or patch is claimed.',
  };
}

function humanDecisionPacket(row: any, recipe: any) {
  const title = recipe?.title ?? decodeTitle(row.titleFa);
  const cls = [recipe?.category, recipe?.region, recipe?.dishType, recipe?.categories].filter(Boolean).join(' ');
  const ambiguity = recipe?.region === 'persian'
    ? 'Iranian home/regional recipe with multiple valid household or regional variants.'
    : 'International/common dish where title may be generic, localized, simplified, or variant-specific.';
  return {
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: title,
    currentIdentity: title,
    ambiguityReason: ambiguity,
    currentSignals: cls,
    likelyValidVariants: [
      'keep current as home-style/simplified variant if product accepts naming',
      'patch to a stricter canonical version after source-backed review',
      'split into regional/canonical variants later',
      'hide until culinary review if trust risk is considered too high',
    ],
    productChoices: [
      'keep as current but rename/qualify',
      'patch to canonical version',
      'split into multiple recipes later',
      'hide/unpublish until culinary review',
      'mark as simplified/home-style variant',
    ],
    recommendedDecision: 'NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING',
    riskIfLeftPublic: 'Medium: not proven wrong, but not defensible as fully authentic.',
    dbPatchSafeNow: false,
    finalState: 'NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING' as ResolvedDecision,
  };
}

function patternHit(blob: string, pattern: string) {
  return pattern
    .split('|')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .some((part) => blob.includes(part));
}

function auditAgainstResolved(recipe: any, rule: any) {
  const blob = recipeBlob(recipe);
  const missingRequired = (rule.requiredCoreIngredients ?? []).filter((p: string) => p && !patternHit(blob, p));
  const forbiddenPresent = (rule.forbiddenIngredients ?? []).filter((p: string) => p && patternHit(blob, p));
  if (rule.publicSafetyDecision === 'HIDE_UNTIL_REVIEW') return 'HIDE_REQUIRED';
  if (rule.publicSafetyDecision === 'PATCH_THEN_PUBLIC') return 'PATCH_REQUIRED';
  if (rule.status === 'NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING') return 'STILL_NEEDS_REVIEW';
  if (missingRequired.length || forbiddenPresent.length) return 'PATCH_REQUIRED';
  return 'PASS_AS_IS';
}

async function main() {
  assertLocalDatabase();
  const countsBefore = await getCounts();
  const classification = readJson(path.join(inputDir, 'final_116_classification.json'));
  const deferred = classification.rows.filter((row: any) =>
    ['NEEDS_EXTERNAL_RESEARCH', 'NEEDS_HUMAN_DECISION'].includes(row.finalStatus),
  );
  const externalRows = deferred.filter((row: any) => row.finalStatus === 'NEEDS_EXTERNAL_RESEARCH');
  const humanRows = deferred.filter((row: any) => row.finalStatus === 'NEEDS_HUMAN_DECISION');
  if (deferred.length !== 85 || externalRows.length !== 39 || humanRows.length !== 46) {
    throw new Error(`EXPECTED_85_39_46_FOUND_${deferred.length}_${externalRows.length}_${humanRows.length}`);
  }

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: deferred.map((row: any) => row.recipeId) } },
    include: {
      ingredients: { include: { ingredient: true }, orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
    },
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const meze = await prisma.recipe.findMany({
    where: { id: { startsWith: 'meze50_' } },
    select: { id: true, status: true, isPublic: true },
    orderBy: { id: 'asc' },
  });

  writeJson('preflight_snapshot.json', {
    generatedAt: new Date().toISOString(),
    countsBefore,
    queue: {
      total: deferred.length,
      needsExternalResearch: externalRows.length,
      needsHumanDecision: humanRows.length,
    },
    meze: {
      total: meze.length,
      public: meze.filter((r) => r.isPublic).length,
      nonDraft: meze.filter((r) => r.status !== 'draft').length,
    },
    recipes: recipes.map(recipeSummary),
  });
  writeMd(
    'preflight_report.md',
    `# Resolve Authenticity 85 Preflight

- generatedAt: ${new Date().toISOString()}
- local/dev DB guard: PASS
- recipe count: ${countsBefore.totalRecipes}
- active/public count: ${countsBefore.activePublic}
- draft/private count: ${countsBefore.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount}
- Meze 50 public: ${meze.filter((r) => r.isPublic).length}
- Meze 50 non-draft: ${meze.filter((r) => r.status !== 'draft').length}
- deferred total: ${deferred.length}
- NEEDS_EXTERNAL_RESEARCH: ${externalRows.length}
- NEEDS_HUMAN_DECISION: ${humanRows.length}
- rollback snapshot before writes: not created because this run performs no DB writes.
`,
  );

  const externalPackets = externalRows.map((row: any) => sourceAttemptPacket(row, byId.get(row.recipeId)));
  writeJson('external_research_packets_39.json', {
    generatedAt: new Date().toISOString(),
    count: externalPackets.length,
    packets: externalPackets,
  });
  writeMd(
    'external_research_summary_39.md',
    `# External Research Summary 39

- generatedAt: ${new Date().toISOString()}
- researched to source-backed threshold: 0
- not enough independent reputable references established in this automated pass: ${externalPackets.length}
- DB patches allowed from this phase: 0

Per hard rule, these recipes are not marked SAFE_PUBLIC_SOURCE_BACKED. They remain in NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING until three independent reputable culinary references are attached and checked against DB content.

| # | Title | Slug | Decision |
|---:|---|---|---|
${externalPackets.map((p, i) => `| ${i + 1} | ${p.titleFa} | ${p.slug} | ${p.finalState} |`).join('\n')}
`,
  );

  const humanPackets = humanRows.map((row: any) => humanDecisionPacket(row, byId.get(row.recipeId)));
  writeJson('human_decision_packets_46.json', {
    generatedAt: new Date().toISOString(),
    count: humanPackets.length,
    packets: humanPackets,
  });
  writeMd(
    'human_decision_packets_46.md',
    `# Human Decision Packets 46

| # | Title | Slug | Recommended Decision | DB Patch Safe Now | Risk |
|---:|---|---|---|---:|---|
${humanPackets
  .map((p, i) => `| ${i + 1} | ${p.titleFa} | ${p.slug} | ${p.recommendedDecision} | ${p.dbPatchSafeNow ? 'yes' : 'no'} | ${p.riskIfLeftPublic} |`)
  .join('\n')}
`,
  );

  const resolvedRules = [
    ...externalPackets.map((p) => ({
      recipeId: p.recipeId,
      slug: p.slug,
      titleFa: p.titleFa,
      status: p.finalState,
      requiredCoreIngredients: p.requiredCoreIngredients,
      forbiddenIngredients: p.forbiddenIngredients,
      suspiciousIngredients: p.suspiciousIngredients,
      requiredTechniques: p.requiredTechnique,
      acceptableVariants: p.acceptableVariants,
      originCountry: p.country,
      regionCity: p.regionCity,
      confidence: p.confidence,
      sourceRefs: p.sourceRefs,
      productDecisionRefs: [],
      publicSafetyDecision: 'HIDE_UNTIL_REVIEW',
      reason: p.reason,
    })),
    ...humanPackets.map((p) => ({
      recipeId: p.recipeId,
      slug: p.slug,
      titleFa: p.titleFa,
      status: p.finalState,
      requiredCoreIngredients: [],
      forbiddenIngredients: [],
      suspiciousIngredients: [],
      requiredTechniques: [],
      acceptableVariants: p.likelyValidVariants,
      originCountry: '',
      regionCity: '',
      confidence: 'LOW',
      sourceRefs: [],
      productDecisionRefs: [{ decision: p.recommendedDecision, reason: p.ambiguityReason }],
      publicSafetyDecision: 'HIDE_UNTIL_REVIEW',
      reason: p.riskIfLeftPublic,
    })),
  ];
  writeJson('authenticity_rules_resolved_85.json', {
    generatedAt: new Date().toISOString(),
    count: resolvedRules.length,
    rules: resolvedRules,
  });

  const auditRows = resolvedRules.map((rule: any) => {
    const recipe = byId.get(rule.recipeId);
    const status = recipe ? auditAgainstResolved(recipe, rule) : 'STILL_NEEDS_REVIEW';
    return {
      recipeId: rule.recipeId,
      slug: rule.slug,
      titleFa: rule.titleFa,
      status,
      publicSafetyDecision: rule.publicSafetyDecision,
      reason: rule.reason,
      ingredientCount: recipe?.ingredients.length ?? 0,
      stepCount: recipe?.steps.length ?? 0,
      isPublic: recipe?.isPublic ?? null,
      recipeStatus: recipe?.status ?? null,
    };
  });
  const auditCounts = auditRows.reduce((acc: Record<string, number>, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  writeJson('audit_85_against_resolved_rules.json', { generatedAt: new Date().toISOString(), statusCounts: auditCounts, rows: auditRows });
  writeMd(
    'audit_85_against_resolved_rules.md',
    `# Audit 85 Against Resolved Rules

${Object.entries(auditCounts).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

| # | Status | Title | Slug | Decision |
|---:|---|---|---|---|
${auditRows.map((r, i) => `| ${i + 1} | ${r.status} | ${r.titleFa} | ${r.slug} | ${r.publicSafetyDecision} |`).join('\n')}
`,
  );
  writeCsv('patch_required_85.csv', auditRows.filter((r) => r.status === 'PATCH_REQUIRED'));
  writeCsv('hide_required_85.csv', auditRows.filter((r) => r.status === 'HIDE_REQUIRED'));
  writeCsv('still_needs_review_85.csv', auditRows.filter((r) => r.status === 'STILL_NEEDS_REVIEW'));

  writeJson('repair_85_rollback.json', []);
  writeMd(
    'repair_85_report.md',
    `# Repair 85 Report

- generatedAt: ${new Date().toISOString()}
- patch candidates meeting all hard conditions: 0
- patched recipes: 0
- rollback entries: 0
- reason: all 85 remain evidence/product-decision limited; no source-backed high-confidence patch was safe.
`,
  );
  writeMd(
    'hide_85_report.md',
    `# Hide 85 Report

- generatedAt: ${new Date().toISOString()}
- hidden/unpublished recipes: 0
- reason: this run did not prove specific wrong identity for any item; it flags manual review blockers instead of silently removing 85 active recipes.
- schema supports hiding via status/isPublic, but no hide write was performed.
`,
  );

  const aiCopyPath = path.join(sprintDir, 'ai_copy_residue_audit_v1.json');
  const aiCopy = fs.existsSync(aiCopyPath) ? readJson(aiCopyPath) : { counts: {} };
  const countsAfter = await getCounts();
  writeJson('post_audit_85.json', {
    generatedAt: new Date().toISOString(),
    countsBefore,
    countsAfter,
    auditCounts,
    aiCopyCounts: aiCopy.counts ?? {},
    patched: [],
    hidden: [],
  });
  writeMd(
    'post_audit_85.md',
    `# Post Audit 85

- generatedAt: ${new Date().toISOString()}
- recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- patched: 0
- hidden: 0
- AI residue CRITICAL: ${aiCopy.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0}
- AI residue HIGH: ${aiCopy.counts?.HIGH_REPEATED_TEMPLATE ?? 0}
- active/public AUTH_FAIL_PUBLIC_BLOCKER among resolved 85: 0 proven content blockers; 85 manual review blockers remain.
`,
  );

  const finalRows = auditRows.map((row) => ({
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: row.titleFa,
    finalState: 'NEEDS_MANUAL_EXTERNAL_REVIEW_REMAINING',
    isPublic: row.isPublic,
    recipeStatus: row.recipeStatus,
    reason: row.reason,
  }));
  writeCsv('final_resolve_85_classification.csv', finalRows);
  writeCsv('final_public_launch_blockers.csv', finalRows);
  writeCsv('final_manual_review_remaining.csv', finalRows);
  writeMd(
    'final_resolve_85_report.md',
    `# Final Resolve 85 Report

- generatedAt: ${new Date().toISOString()}
- DB count before/after: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public before/after: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private before/after: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count before/after: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- researched count reaching 3-source threshold: 0
- product-decision pass count: 0
- source-backed pass count: 0
- patched count: 0
- hidden/unpublished count: 0
- blocked by dictionary count: 0
- still needs manual review count: ${finalRows.length}
- AI-copy critical/high before/after: ${aiCopy.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0}/${aiCopy.counts?.HIGH_REPEATED_TEMPLATE ?? 0}
- build status: run server build after this script

## Patched Recipes

None.

## Hidden Recipes

None.

## Public But Not Fully Source-Backed

All 85 remain public/manual-review blockers unless separately hidden by product decision. This is intentional: no individual item was proven wrong enough to hide automatically, and no item had enough evidence to patch safely.

## Exact Remaining Risk

Public blocker risk reduced only at the documentation/classification layer. Full culinary authenticity still requires remaining human/external review. Do not claim full global authenticity.

Final verdict: FAIL HARD PASS / PASS TRANSPARENT CLASSIFICATION
`,
  );

  console.log(JSON.stringify({ ok: true, total: deferred.length, external: externalRows.length, human: humanRows.length, patched: 0, hidden: 0 }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
