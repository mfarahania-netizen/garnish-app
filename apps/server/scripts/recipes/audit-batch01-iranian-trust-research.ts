import {
  assertLocalDatabase,
  evaluate,
  getCounts,
  loadBatchRecipes,
  prisma,
  redactedDbUrl,
  regressionStatus,
  rollbackEntry,
  writeJson,
  writeMd,
} from './batch01-iranian-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadBatchRecipes();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    return {
      recipeId: recipe?.id ?? null,
      slug: rule.slug,
      titleFa: recipe?.title ?? rule.titleFa,
      currentStatus: recipe?.status ?? null,
      currentIsPublic: recipe?.isPublic ?? null,
      classification: result.status,
      missingSignals: result.missing,
      forbiddenSignals: result.forbidden,
      exactBlocker: result.exactBlocker,
      ingredientCount: recipe?.ingredients?.length ?? 0,
      stepCount: recipe?.steps?.length ?? 0,
    };
  });
  const rollback = loaded.filter((x) => x.recipe).map(({ rule, recipe }) => rollbackEntry(recipe, rule.slug));
  const statusCounts = rows.reduce((acc: Record<string, number>, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1;
    return acc;
  }, {});
  const regression = await regressionStatus();

  writeJson('batch01_audit_before.json', { generatedAt, counts, statusCounts, regression, rows });
  writeJson('batch01_rollback.json', { generatedAt, databaseUrl: redactedDbUrl(), countsBefore: counts, entries: rollback });
  writeMd('preflight.md', `# Batch 01 Iranian Trust Preflight

- generatedAt: ${generatedAt}
- DATABASE_URL guard: PASS local/dev (${redactedDbUrl()})
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze public count: ${counts.mezePublic}
- batch scope: ${rows.length}
- rollback entries: ${rollback.length}
`);
  writeMd('batch01_audit_before.md', `# Batch 01 Audit Before Apply

- generatedAt: ${generatedAt}
- RESTORE_PUBLIC_AS_IS: ${statusCounts.RESTORE_PUBLIC_AS_IS ?? 0}
- PATCH_THEN_RESTORE_PUBLIC: 0
- RENAME_OR_REFRAME_THEN_RESTORE_PUBLIC: 0
- KEEP_REVIEWONLY_WITH_EXACT_REASON: ${statusCounts.KEEP_REVIEWONLY_WITH_EXACT_REASON ?? 0}
- Gamaj Kabab regression: ${regression.gamaj}
- Qeymeh Rizeh regression: ${regression.qeymeh}

| # | State | Title | Slug | Missing/Blocker |
|---:|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.classification} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, statusCounts, regression }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
