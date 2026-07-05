import {
  assertLocalDatabase,
  closeoutDecision,
  getCounts,
  loadQueue,
  loadRecipes,
  prisma,
  redactedDbUrl,
  regressionStatus,
  rollbackEntry,
  writeCsv,
  writeJson,
  writeMd,
} from './recipe-trust-closeout-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const queue = loadQueue();
  const recipes = await loadRecipes(queue.map((row) => row.recipeId));
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const missing = queue.filter((row) => !byId.has(row.recipeId));
  if (missing.length) throw new Error(`MISSING_QUEUE_RECIPES:${missing.map((row) => row.recipeId).join(',')}`);
  const counts = await getCounts();
  const rollback = queue.map((row) => rollbackEntry(byId.get(row.recipeId), row.slug));
  const decisions = queue.map((row) => closeoutDecision(row, byId.get(row.recipeId)));
  const keepRows = decisions.map((d) => ({
    recipeId: d.recipeId,
    slug: d.slug,
    titleFa: d.titleFa,
    classification: 'KEEP_REVIEWONLY',
    exactBlocker: d.exactBlocker,
    status: d.currentStatus,
    isPublic: d.currentIsPublic,
  }));
  const regression = await regressionStatus();

  writeJson('rollback_85_before_closeout.json', { generatedAt, databaseUrl: redactedDbUrl(), counts, entries: rollback });
  writeMd(
    'preflight_report.md',
    `# Recipe Trust Closeout Preflight

- generatedAt: ${generatedAt}
- DATABASE_URL guard: PASS local/dev (${redactedDbUrl()})
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze 50 public count: ${counts.mezePublic}
- 85 queue rows loaded: ${queue.length}
- queue active/public before closeout: ${recipes.filter((r) => r.status === 'active' && r.isPublic).length}
- rollback snapshot: rollback_85_before_closeout.json
`,
  );
  writeJson('research_packets_85.json', { generatedAt, count: decisions.length, packets: decisions });
  writeMd(
    'research_summary_85.md',
    `# Research Summary 85

- generatedAt: ${generatedAt}
- source-backed HIGH confidence restored candidates: 0
- source-backed MEDIUM confidence restored candidates: 0
- insufficient-evidence reviewOnly decisions: ${decisions.length}

No fake source-backed claims were created. This pass found no attached three-source or defensible product-decision packet that would justify restoring any of the 85 to public.
`,
  );
  writeJson('product_decisions_85.json', {
    generatedAt,
    decisions: decisions.map((d) => ({
      recipeId: d.recipeId,
      slug: d.slug,
      titleFa: d.titleFa,
      currentProblem: 'Recipe was hidden because public authenticity was unresolved.',
      safePublicIdentity: null,
      sourceOrReasoningBasis: 'No sufficient source/product-decision basis established in this sprint.',
      publicSafe: false,
      titleDescriptionChangeRequired: false,
      patchRequired: false,
      riskIfLeftUnchanged: 'If restored public now, it becomes public + unresolved, which is a forbidden final state.',
      finalState: d.finalState,
      exactBlocker: d.exactBlocker,
    })),
  });
  writeMd(
    'product_decisions_85.md',
    `# Product Decisions 85

- generatedAt: ${generatedAt}
- RESTORED_PUBLIC_PRODUCT_DECISION_PASS: 0
- STILL_REVIEWONLY_WITH_EXACT_BLOCKER: ${decisions.length}

| # | Title | Slug | Public Safe | Exact Blocker |
|---:|---|---|---|---|
${decisions.map((d, index) => `| ${index + 1} | ${d.titleFa} | ${d.slug} | no | ${d.exactBlocker} |`).join('\n')}
`,
  );
  writeJson('audit_85_against_research.json', {
    generatedAt,
    counts,
    statusCounts: { KEEP_REVIEWONLY: keepRows.length },
    regression,
    rows: keepRows,
  });
  writeMd(
    'audit_85_against_research.md',
    `# Audit 85 Against Research/Product Decisions

- generatedAt: ${generatedAt}
- SAFE_TO_RESTORE_PUBLIC_AS_IS: 0
- PATCH_THEN_RESTORE_PUBLIC: 0
- REFRAME_THEN_RESTORE_PUBLIC: 0
- KEEP_REVIEWONLY: ${keepRows.length}
- Gamaj Kabab regression: ${regression.gamaj.status}
- Qeymeh Rizeh regression: ${regression.qeymeh.status}

| # | Classification | Title | Slug | Exact Blocker |
|---:|---|---|---|---|
${keepRows.map((row, index) => `| ${index + 1} | ${row.classification} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker} |`).join('\n')}
`,
  );
  writeCsv('safe_to_restore_public.csv', [], ['recipeId', 'slug', 'titleFa', 'basis']);
  writeCsv('patch_then_restore_public.csv', [], ['recipeId', 'slug', 'titleFa', 'patchType', 'basis']);
  writeCsv('reframe_then_restore_public.csv', [], ['recipeId', 'slug', 'titleFa', 'newTitle', 'basis']);
  writeCsv('keep_reviewonly.csv', keepRows, ['recipeId', 'slug', 'titleFa', 'classification', 'exactBlocker', 'status', 'isPublic']);
  console.log(JSON.stringify({ ok: true, safeToRestore: 0, patchThenRestore: 0, reframeThenRestore: 0, keepReviewOnly: keepRows.length }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
