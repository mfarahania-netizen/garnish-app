import {
  assertLocalDatabase,
  finalStateRow,
  getCounts,
  loadBlockers,
  loadRecipes,
  prisma,
  sourcePacket,
  writeCsv,
  writeJson,
  writeMd,
} from './resolve-authenticity-85-no-public-blockers-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const blockers = loadBlockers();
  const recipes = await loadRecipes(blockers.map((row) => row.recipeId));
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const missing = blockers.filter((row) => !byId.has(row.recipeId));
  if (missing.length) throw new Error(`MISSING_BLOCKER_RECIPES:${missing.map((row) => row.recipeId).join(',')}`);

  const counts = await getCounts();
  const packets = blockers.map((row) => sourcePacket(row, byId.get(row.recipeId)));
  const decisions = packets.map((packet) => ({
    recipeId: packet.recipeId,
    slug: packet.slug,
    titleFa: packet.titleFa,
    finalState: 'HIDDEN_PENDING_REVIEW',
    safeToRemainPublic: false,
    whyThisIsSafe: 'Safe for launch only after hiding; no unsupported authenticity claim remains public.',
    whatUserWillSee: 'Nothing on public search/API/detail until culinary review republishes it.',
    titleOrDescriptionChangeRequired: false,
    riskIfLeftUnchanged: 'Public unresolved authenticity blocker; trust damage if a user notices wrong regional/canonical identity.',
  }));
  const rules = packets.map((packet) => ({
    recipeId: packet.recipeId,
    slug: packet.slug,
    titleFa: packet.titleFa,
    finalState: 'HIDDEN_PENDING_REVIEW',
    publicSafetyDecision: 'HIDE_UNTIL_REVIEW',
    sourceRefs: packet.sourceRefs,
    productDecisionRefs: [],
    requiredCoreIngredients: packet.requiredCoreIngredients,
    forbiddenIngredients: packet.forbiddenIngredients,
    suspiciousIngredients: packet.suspiciousIngredients,
    requiredTechniques: packet.requiredTechniques,
    acceptableVariants: packet.acceptableVariants,
    confidence: 'LOW',
    reason: packet.reason,
  }));
  const auditRows = blockers.map((row) => {
    const recipe = byId.get(row.recipeId);
    return {
      recipeId: row.recipeId,
      slug: row.slug,
      titleFa: recipe?.title ?? row.titleFa,
      classification: 'HIDE_REQUIRED',
      currentStatus: recipe?.status ?? null,
      currentIsPublic: recipe?.isPublic ?? null,
      reason: 'Unresolved authenticity risk without three-source or product-decision pass.',
      requiredAction: 'Set status=reviewOnly and isPublic=false before launch.',
      ingredientCount: recipe?.ingredients?.length ?? 0,
      stepCount: recipe?.steps?.length ?? 0,
    };
  });

  writeJson('research_packets_85.json', { generatedAt, count: packets.length, packets });
  writeMd(
    'research_summary_85.md',
    `# Research Summary 85

- generatedAt: ${generatedAt}
- source-backed pass packets created: 0
- product-decision pass packets created: 0
- unresolved packets: ${packets.length}
- decision: all unresolved items require hiding before launch.

No fake sources were created. The repository does not contain three independent reputable references for these 85 items, so none is promoted to source-backed public status.
`,
  );
  writeJson('product_decisions_85.json', { generatedAt, count: decisions.length, decisions });
  writeMd(
    'product_decisions_85.md',
    `# Product Decisions 85

- generatedAt: ${generatedAt}
- PRODUCT_DECISION_PASS_PUBLIC: 0
- HIDDEN_PENDING_REVIEW: ${decisions.length}

| # | Title | Slug | Decision | Risk If Public |
|---:|---|---|---|---|
${decisions.map((d, index) => `| ${index + 1} | ${d.titleFa} | ${d.slug} | ${d.finalState} | ${d.riskIfLeftUnchanged} |`).join('\n')}
`,
  );
  writeJson('authenticity_rules_resolved_85.json', { generatedAt, count: rules.length, rules });
  writeJson('audit_85_final_decisions.json', {
    generatedAt,
    counts,
    statusCounts: { HIDE_REQUIRED: auditRows.length },
    rows: auditRows,
  });
  writeMd(
    'audit_85_final_decisions.md',
    `# Audit 85 Against Final Decisions

- generatedAt: ${generatedAt}
- DB total recipes: ${counts.totalRecipes}
- active/public before hide: ${counts.activePublic}
- ingredient count: ${counts.ingredientCount}
- PASS_AS_IS_PUBLIC: 0
- PATCH_REQUIRED: 0
- RENAME_OR_REFRAME_REQUIRED: 0
- HIDE_REQUIRED: ${auditRows.length}
- BLOCKED_BY_DICTIONARY: 0

| # | Classification | Title | Slug | Required Action |
|---:|---|---|---|---|
${auditRows.map((row, index) => `| ${index + 1} | ${row.classification} | ${row.titleFa} | ${row.slug} | ${row.requiredAction} |`).join('\n')}
`,
  );
  writeCsv('patch_required.csv', [], ['recipeId', 'slug', 'titleFa', 'reason']);
  writeCsv('rename_required.csv', [], ['recipeId', 'slug', 'titleFa', 'reason']);
  writeCsv('hide_required.csv', auditRows, ['recipeId', 'slug', 'titleFa', 'classification', 'currentStatus', 'currentIsPublic', 'reason', 'requiredAction']);
  writeCsv('final_85_states.csv', blockers.map((row) => finalStateRow(row, byId.get(row.recipeId))), [
    'recipeId',
    'slug',
    'titleFa',
    'finalState',
    'status',
    'isPublic',
    'reason',
  ]);

  console.log(JSON.stringify({ ok: true, audited: auditRows.length, hideRequired: auditRows.length }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
