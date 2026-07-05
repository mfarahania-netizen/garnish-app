import { assertLocalDatabase, evaluate, getCounts, loadRecipes, prisma, regressionStatus, rules, writeJson, writeMd } from './final-27-recipe-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadRecipes();
  const regression = await regressionStatus();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    const payloadOk = !!recipe && !!recipe.id && !!recipe.title && !!recipe.gris && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && Array.isArray(recipe.steps) && recipe.steps.length > 0;
    const publicOk = !!recipe && recipe.status === 'active' && recipe.isPublic === true;
    const searchable = !!recipe && recipe.searchTerms?.length > 0;
    return {
      recipeId: recipe?.id ?? null,
      slug: rule.slug,
      titleFa: recipe?.title ?? rule.titleFa,
      finalState: result.finalState,
      publicOk,
      payloadOk,
      searchable,
      ingredientCount: recipe?.ingredients?.length ?? 0,
      stepCount: recipe?.steps?.length ?? 0,
      exactBlocker: result.exactBlocker,
    };
  });
  const blockers = rows.filter((row) => row.finalState !== 'RESTORE_PUBLIC_AS_IS' || !row.publicOk);
  const apiFailures = rows.filter((row) => !row.payloadOk);
  const searchFailures = rows.filter((row) => !row.searchable || !row.publicOk);
  const ok = blockers.length === 0 && apiFailures.length === 0 && searchFailures.length === 0 && regression.gamaj === 'PASS' && regression.qeymeh === 'PASS' && counts.totalRecipes === 639 && counts.ingredientCount === 1084 && counts.activePublic === 589 && counts.mezePublic === 0;

  writeJson('final27_post_audit.json', { generatedAt, ok, counts, regression, rows, blockers, apiFailures, searchFailures });
  writeMd('final27_post_audit.md', `# Final 27 Post-Audit

- generatedAt: ${generatedAt}
- verdict: ${ok ? 'PASS' : 'FAIL'}
- total recipes: ${counts.totalRecipes}
- active/public: ${counts.activePublic}
- draft/private/review: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze public: ${counts.mezePublic}
- baseline rows checked: ${rows.length}/${rules.length}
- restored public: ${rows.filter((row) => row.publicOk).length}/${rules.length}
- unresolved public blockers: ${blockers.length}
- API/source payload failures: ${apiFailures.length}
- search smoke failures: ${searchFailures.length}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

| # | Public | Baseline | API payload | Search | Ingredients | Steps | Title | Slug | Blocker |
|---:|---|---|---|---|---:|---:|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.publicOk ? 'PASS' : 'FAIL'} | ${row.finalState === 'RESTORE_PUBLIC_AS_IS' ? 'PASS' : 'FAIL'} | ${row.payloadOk ? 'PASS' : 'FAIL'} | ${row.searchable ? 'PASS' : 'FAIL'} | ${row.ingredientCount} | ${row.stepCount} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  writeMd('final27_api_search_smoke.md', `# Final 27 API/Search Smoke

- generatedAt: ${generatedAt}
- verdict: ${apiFailures.length === 0 && searchFailures.length === 0 ? 'PASS' : 'FAIL'}
- source/API payload rows checked: ${rows.length}
- source/API payload failures: ${apiFailures.length}
- search rows checked: ${rows.length}
- search failures: ${searchFailures.length}

| # | Payload | Search | Public | Title | Slug |
|---:|---|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.payloadOk ? 'PASS' : 'FAIL'} | ${row.searchable ? 'PASS' : 'FAIL'} | ${row.publicOk ? 'PASS' : 'FAIL'} | ${row.titleFa} | ${row.slug} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok, counts, blockers: blockers.length, apiFailures: apiFailures.length, searchFailures: searchFailures.length, regression }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});
