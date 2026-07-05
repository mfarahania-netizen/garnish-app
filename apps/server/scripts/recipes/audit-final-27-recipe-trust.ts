import { assertLocalDatabase, evaluate, getCounts, loadRecipes, redactedDbUrl, regressionStatus, rollbackEntry, rules, writeJson, writeMd } from './final-27-recipe-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadRecipes();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    return {
      recipeId: recipe?.id ?? null,
      slug: rule.slug,
      titleFa: recipe?.title ?? rule.titleFa,
      country: rule.country,
      currentStatus: recipe?.status ?? null,
      currentIsPublic: recipe?.isPublic ?? null,
      ingredientCount: recipe?.ingredients?.length ?? 0,
      stepCount: recipe?.steps?.length ?? 0,
      finalState: result.finalState,
      missing: result.missing,
      forbiddenHits: result.forbiddenHits,
      exactBlocker: result.exactBlocker,
    };
  });
  const missingRecipes = rows.filter((row) => !row.recipeId);
  if (missingRecipes.length) throw new Error(`MISSING_FINAL27_RECIPES:${missingRecipes.map((row) => row.slug).join(',')}`);
  const restore = rows.filter((row) => row.finalState === 'RESTORE_PUBLIC_AS_IS');
  const keep = rows.filter((row) => row.finalState !== 'RESTORE_PUBLIC_AS_IS');
  const rollback = loaded.map(({ rule, recipe }) => rollbackEntry(recipe, rule.slug));
  const regression = await regressionStatus();

  writeJson('final27_rollback.json', { generatedAt, databaseUrl: redactedDbUrl(), counts, entries: rollback });
  writeMd('preflight.md', `# Final 27 Recipe Trust Preflight

- generatedAt: ${generatedAt}
- DATABASE_URL guard: PASS local/dev (${redactedDbUrl()})
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze public count: ${counts.mezePublic}
- final 27 loaded: ${rows.length}/${rules.length}
- rollback snapshot: final27_rollback.json
`);
  writeJson('final27_audit_before.json', { generatedAt, counts, regression, restoreCount: restore.length, keepReviewOnlyCount: keep.length, rows });
  writeMd('final27_audit_before.md', `# Final 27 Audit Before Apply

- generatedAt: ${generatedAt}
- restore as-is candidates: ${restore.length}
- keep reviewOnly candidates: ${keep.length}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

| # | Final State | Title | Slug | Current | Ingredients | Steps | Blocker |
|---:|---|---|---|---|---:|---:|---|
${rows.map((row, index) => `| ${index + 1} | ${row.finalState} | ${row.titleFa} | ${row.slug} | ${row.currentStatus}/${row.currentIsPublic} | ${row.ingredientCount} | ${row.stepCount} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, rows: rows.length, restore: restore.length, keepReviewOnly: keep.length, counts, regression }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
